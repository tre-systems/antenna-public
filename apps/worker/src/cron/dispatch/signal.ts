import type { AdapterResult } from '@antenna/connectors';
import { sourcePolicyForTemplate, templates } from '@antenna/registry';
import { prepareAdapterConfig } from './config';
import { cloudRefreshEligibility } from './eligibility';
import { errorMessage, logDispatchError } from './log';
import { processResult } from './result';
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
  const adapterRun = await runAdapter(client, env, signal, template);
  if (!adapterRun.ok) return failSignal(ctx, client, env, signal, now, adapterRun.message);
  return processResult(ctx, client, env, signal, now, adapterRun.result, {
    retainRawPayload: template.retainRawPayload === true,
    alertRules: template.alertRules ?? [],
  });
};

const findTemplate = (templateId: string): DispatchTemplate | undefined =>
  templates.find((template) => template.id === templateId);

const runAdapter = async (
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  template: DispatchTemplate,
): Promise<{ ok: true; result: AdapterResult } | { ok: false; message: string }> => {
  try {
    const config = prepareAdapterConfig(client, env, signal, template);
    if (!config.ok) return config;
    const adapter = template.adapter as (cfg: Record<string, unknown>) => Promise<AdapterResult>;
    return { ok: true, result: await adapter(config.config) };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
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
  logDispatchError({
    event: 'dispatch_status_write_failed',
    run_id: ctx.runId,
    signal_id: signal.id,
    collection_id: signal.collectionId,
    template_id: signal.templateId,
    error: errorMessage(failErr),
    original_error: originalError,
  });
};
