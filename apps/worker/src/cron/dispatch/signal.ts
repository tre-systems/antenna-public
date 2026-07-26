import type { AdapterResult } from '@antenna/connectors';
import { sourcePolicyForTemplate, templates } from '@antenna/registry';
import { parseJsonRecord } from '../../db/codecs';
import { prepareAdapterConfig } from './config';
import { cloudRefreshEligibility } from './eligibility';
import { errorMessage, logErrorEvent, logEvent } from '../log';
import { processResult } from './result';
import {
  isShareableTemplate,
  maxSnapshotAgeMs,
  readSharedSnapshot,
  sharedSnapshotResult,
  snapshotCacheKey,
  writeSharedSnapshot,
} from './snapshot-cache';
import { failSignal } from './status';
import type {
  SignalRow,
  Client,
  CollectionRow,
  DispatchContext,
  DispatchEnv,
  DispatchTemplate,
} from './types';

export const processDueSignal = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  collection: CollectionRow,
  now: number,
): Promise<boolean> => {
  try {
    return await processSignal(ctx, client, env, signal, collection, now);
  } catch (err) {
    return handleUnexpectedDispatchError(ctx, client, env, signal, now, err);
  }
};

const processSignal = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  collection: CollectionRow,
  now: number,
): Promise<boolean> => {
  const template = findTemplate(signal.templateId);
  if (!template)
    return failSignal(ctx, client, env, signal, now, `unknown template ${signal.templateId}`);
  const policy = sourcePolicyForTemplate(template.id);
  const eligibility = cloudRefreshEligibility(policy, collection.visibility, signal.visibility);
  if (!eligibility.ok) return failSignal(ctx, client, env, signal, now, eligibility.message);
  const adapterRun = await runAdapter(ctx, client, env, signal, collection, template, now);
  if (!adapterRun.ok) return failSignal(ctx, client, env, signal, now, adapterRun.message);
  return processResult(ctx, client, env, signal, now, adapterRun.result, {
    retainRawPayload: template.retainRawPayload === true,
    alertRules: template.alertRules ?? [],
  });
};

const findTemplate = (templateId: string): DispatchTemplate | undefined =>
  templates.find((template) => template.id === templateId);

const runAdapter = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  collection: CollectionRow,
  template: DispatchTemplate,
  now: number,
): Promise<{ ok: true; result: AdapterResult } | { ok: false; message: string }> => {
  try {
    const config = await prepareAdapterConfig(client, env, signal, collection, template);
    if (!config.ok) return config;
    const adapter = template.adapter as (cfg: Record<string, unknown>) => Promise<AdapterResult>;
    if (!isShareableTemplate(template)) {
      return { ok: true, result: await adapter(config.config) };
    }
    return {
      ok: true,
      result: await sharedFetch(ctx, client, signal, template, now, () => adapter(config.config)),
    };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
};

// One upstream call serves every signal asking for the same thing. Two layers:
// a stored snapshot covers users whose refresh times have drifted apart across
// ticks, and an in-flight map collapses the identical calls that would
// otherwise run side by side within one tick.
//
// Only the fetch is shared. Points, status, alerts, and history stay per
// signal, so a shared result is indistinguishable from a private one
// downstream.
const sharedFetch = async (
  ctx: DispatchContext,
  client: Client,
  signal: SignalRow,
  template: DispatchTemplate,
  now: number,
  fetchUpstream: () => Promise<AdapterResult>,
): Promise<AdapterResult> => {
  const cacheKey = snapshotCacheKey(template.id, parseJsonRecord(signal.config));

  const stored = await readSharedSnapshot(client, cacheKey, maxSnapshotAgeMs(signal), now);
  if (stored) {
    logSharedSnapshotHit(ctx, signal, template, 'stored');
    return sharedSnapshotResult(stored);
  }

  const alreadyRunning = ctx.inFlight.get(cacheKey);
  if (alreadyRunning) {
    logSharedSnapshotHit(ctx, signal, template, 'in_flight');
    return alreadyRunning;
  }

  const running = fetchUpstream();
  ctx.inFlight.set(cacheKey, running);
  try {
    const result = await running;
    // Only successes are shared. An error belongs to the signal that hit it, so
    // each one keeps its own retry backoff.
    if (result.ok) await writeSharedSnapshot(client, cacheKey, template.id, result.points, now);
    return result;
  } finally {
    ctx.inFlight.delete(cacheKey);
  }
};

const logSharedSnapshotHit = (
  ctx: DispatchContext,
  signal: SignalRow,
  template: DispatchTemplate,
  source: 'stored' | 'in_flight',
): void => {
  logEvent({
    event: 'upstream_fetch_shared',
    run_id: ctx.runId,
    signal_id: signal.id,
    template_id: template.id,
    source,
  });
};

const handleUnexpectedDispatchError = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  err: unknown,
): Promise<boolean> => {
  const message = `unexpected_dispatch_error: ${errorMessage(err)}`;
  try {
    return await failSignal(ctx, client, env, signal, now, message);
  } catch (failErr) {
    logStatusWriteFailure(ctx, signal, message, failErr);
    return false;
  }
};

const logStatusWriteFailure = (
  ctx: DispatchContext,
  signal: SignalRow,
  originalError: string,
  failErr: unknown,
): void => {
  logErrorEvent({
    event: 'dispatch_status_write_failed',
    run_id: ctx.runId,
    signal_id: signal.id,
    collection_id: signal.collectionId,
    template_id: signal.templateId,
    error: errorMessage(failErr),
    original_error: originalError,
  });
};
