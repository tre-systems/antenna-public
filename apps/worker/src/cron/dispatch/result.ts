import type { AdapterError, AdapterResult, DataPoint } from '@antenna/connectors';
import type { AlertRule } from '@antenna/registry';
import { sql } from 'drizzle-orm';
import { signalPoints } from '../../db/schema';
import { notifyCollection } from '../notify';
import { toPointRow } from '../point-row';
import { evaluateAlertRules } from './alerts';
import { recordSnapshotState, snapshotDecision } from './data-change';
import { logEvent } from '../log';
import {
  failSignal,
  markSignalStale,
  readStatus,
  retryDelayForAdapterError,
  writeStatus,
} from './status';
import type { SignalRow, Client, DispatchContext, DispatchEnv } from './types';

type ResultOptions = {
  readonly retainRawPayload: boolean;
  readonly alertRules: readonly AlertRule[];
};

const DATA_POINT_INSERT_BATCH_SIZE = 10;

export const processResult = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  result: AdapterResult,
  options: ResultOptions,
): Promise<boolean> => {
  if (!result.ok) return processAdapterError(ctx, client, env, signal, now, result.error);
  return recordSuccessfulResult(ctx, client, env, signal, now, result, options);
};

const processAdapterError = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  error: AdapterError,
): Promise<boolean> => {
  const message = error.message.startsWith('setup_required:')
    ? error.message
    : `${error.code}: ${error.message}`;
  const retryDelay = retryDelayForAdapterError(error, signal.refreshSeconds);
  if (await shouldMarkStale(client, signal, error)) {
    return markSignalStale(ctx, client, env, signal, now, message, retryDelay);
  }
  return failSignal(ctx, client, env, signal, now, message, retryDelay);
};

const shouldMarkStale = async (
  client: Client,
  signal: SignalRow,
  error: AdapterError,
): Promise<boolean> => {
  if (!isRecoverableAdapterError(error)) return false;
  const previous = await readStatus(client, signal.id);
  return previous?.lastOkAt !== null && previous?.lastOkAt !== undefined;
};

const recordSuccessfulResult = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  result: Extract<AdapterResult, { ok: true }>,
  options: ResultOptions,
): Promise<boolean> => {
  const previous = await readStatus(client, signal.id);
  const snapshot = await snapshotDecision(result.points, previous, now);
  const rawKey =
    snapshot.changed && snapshot.persist
      ? await storeRawPayload(env, signal, result, now, options.retainRawPayload)
      : null;
  if (snapshot.changed) {
    await evaluateAlertRules(client, signal, result.points, now, options.alertRules);
  }
  if (snapshot.persist) {
    await insertPoints(client, signal.id, result.points, now, rawKey);
  }
  await writeStatus(client, signal.id, now, null);
  if (snapshot.persist) {
    await recordSnapshotState(client, signal.id, snapshot.hash, now);
  }
  await notifySignalUpdated(ctx, env, signal, now, snapshot.persist ? result.points.length : 0);
  return true;
};

const storeRawPayload = async (
  env: DispatchEnv,
  signal: SignalRow,
  result: Extract<AdapterResult, { ok: true }>,
  now: number,
  retainRawPayload: boolean,
): Promise<string | null> => {
  const rawKey = retainRawPayload ? `${signal.id}/${String(now)}.json` : null;
  if (rawKey !== null) await env.PAYLOADS.put(rawKey, JSON.stringify(result.rawPayload));
  return rawKey;
};

const insertPoints = async (
  client: Client,
  signalId: string,
  points: ReadonlyArray<DataPoint>,
  now: number,
  rawPayloadId: string | null,
): Promise<void> => {
  if (points.length === 0) return;
  const rows = points.map((point) => toPointRow(signalId, point, now, rawPayloadId));
  await insertPointBatches(client, rows);
};

const insertPointBatches = async (
  client: Client,
  rows: ReadonlyArray<typeof signalPoints.$inferInsert>,
): Promise<void> => {
  for (let i = 0; i < rows.length; i += DATA_POINT_INSERT_BATCH_SIZE) {
    await client
      .insert(signalPoints)
      .values(rows.slice(i, i + DATA_POINT_INSERT_BATCH_SIZE))
      .onConflictDoUpdate({
        target: [signalPoints.signalId, signalPoints.observedAt, signalPoints.metricKey],
        set: {
          fetchedAt: sql`excluded.fetched_at`,
          dimensions: sql`excluded.dimensions`,
          value: sql`excluded.value`,
          valueText: sql`excluded.value_text`,
          unit: sql`excluded.unit`,
          sourceUrl: sql`excluded.source_url`,
          rawPayloadId: sql`excluded.raw_payload_id`,
        },
      })
      .run();
  }
};

const notifySignalUpdated = async (
  ctx: DispatchContext,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  pointCount: number,
): Promise<void> => {
  await notifyCollection(env, signal.collectionId, {
    type: 'signal_updated',
    signal_id: signal.id,
    fetched_at: now,
  });
  logSuccessfulSignal(ctx, signal, pointCount);
};

const logSuccessfulSignal = (ctx: DispatchContext, signal: SignalRow, pointCount: number): void => {
  logEvent({
    event: 'signal_dispatch_completed',
    run_id: ctx.runId,
    signal_id: signal.id,
    collection_id: signal.collectionId,
    template_id: signal.templateId,
    status: 'live',
    points: pointCount,
  });
};

const isRecoverableAdapterError = (error: AdapterError): boolean =>
  error.code === 'fetch_failed' || error.code === 'rate_limited';
