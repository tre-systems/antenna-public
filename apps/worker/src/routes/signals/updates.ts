import { eq } from 'drizzle-orm';
import { templates } from '@antenna/registry';
import { parseJsonRecord } from '../../db/codecs';
import { signalStatus, signals, signalPoints, type SignalConfig } from '../../db/schema';
import { validateTemplateConfig } from '../../registry/config';
import { clampRefreshSeconds } from './refresh';
import { externalVisibilityBlocker, type PublicVisibilityBlocker } from './source-policy';
import type { SignalRow, Client } from './types';

type TemplateWithConfigSchema = Parameters<typeof validateTemplateConfig>[0];

export type SignalUpdateInput = {
  readonly config?: Record<string, unknown>;
  readonly refresh_seconds?: number;
  readonly visibility?: SignalRow['visibility'];
};

type ResolvedSignalUpdate = {
  readonly nextConfig: Record<string, unknown>;
  readonly nextRefreshSeconds: number;
  readonly nextVisibility: SignalRow['visibility'];
  readonly configChanged: boolean;
};

export type SignalUpdateFailure =
  | { readonly kind: 'error'; readonly error: string; readonly status: 400 | 409 }
  | { readonly kind: 'source_policy_blocked'; readonly blocker: PublicVisibilityBlocker };

type SignalUpdateResult =
  | { readonly ok: true; readonly update: ResolvedSignalUpdate }
  | { readonly ok: false; readonly failure: SignalUpdateFailure };

export const resolveSignalUpdate = (
  signal: SignalRow,
  input: SignalUpdateInput,
): SignalUpdateResult => {
  const template = templates.find((candidate) => candidate.id === signal.templateId);
  if (!template) return errorResult('unknown_template', 409);

  const config = resolveNextConfig(signal, template, input.config);
  if (!config.ok) return errorResult(config.error, 400);

  const visibility = resolveNextVisibility(signal, input.visibility);
  if (!visibility.ok) return visibility;

  return {
    ok: true,
    update: {
      nextConfig: config.value,
      nextRefreshSeconds: nextRefreshSeconds(signal, input.refresh_seconds),
      nextVisibility: visibility.value,
      configChanged: input.config !== undefined,
    },
  };
};

export const persistSignalUpdate = async (
  client: Client,
  signal: SignalRow,
  update: ResolvedSignalUpdate,
): Promise<void> => {
  await updateSignalRow(client, signal, update);
  if (update.configChanged) await clearSignalData(client, signal.id);
};

export const signalUpdateResponse = (update: ResolvedSignalUpdate) => ({
  updated: true,
  config: update.nextConfig,
  refresh_seconds: update.nextRefreshSeconds,
  visibility: update.nextVisibility,
  cleared_points: update.configChanged,
});

const updateSignalRow = async (
  client: Client,
  signal: SignalRow,
  update: ResolvedSignalUpdate,
): Promise<void> => {
  await client
    .update(signals)
    .set({
      config: JSON.stringify(update.nextConfig) as unknown as SignalConfig,
      refreshSeconds: update.nextRefreshSeconds,
      visibility: update.nextVisibility,
      updatedAt: new Date(),
    })
    .where(eq(signals.id, signal.id))
    .run();
};

const clearSignalData = async (client: Client, signalId: string): Promise<void> => {
  await client.delete(signalPoints).where(eq(signalPoints.signalId, signalId)).run();
  await client.delete(signalStatus).where(eq(signalStatus.signalId, signalId)).run();
};

const resolveNextConfig = (
  signal: SignalRow,
  template: TemplateWithConfigSchema,
  patch: Record<string, unknown> | undefined,
):
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly error: string } => {
  const existingConfig = parseJsonRecord(signal.config);
  if (patch === undefined) return { ok: true, value: existingConfig };

  try {
    return { ok: true, value: validateTemplateConfig(template, { ...existingConfig, ...patch }) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : 'invalid_config' };
  }
};

const resolveNextVisibility = (
  signal: SignalRow,
  visibility: SignalRow['visibility'] | undefined,
):
  | { readonly ok: true; readonly value: SignalRow['visibility'] }
  | { readonly ok: false; readonly failure: SignalUpdateFailure } => {
  if (visibility === undefined) return { ok: true, value: signal.visibility };

  const next = visibility;
  if (next === 'private') return { ok: true, value: next };

  const blocker = externalVisibilityBlocker(signal.templateId, next);
  return blocker
    ? { ok: false, failure: { kind: 'source_policy_blocked', blocker } }
    : { ok: true, value: next };
};

const nextRefreshSeconds = (signal: SignalRow, seconds: number | undefined): number =>
  seconds === undefined ? signal.refreshSeconds : clampRefreshSeconds(seconds);

const errorResult = (error: string, status: 400 | 409): SignalUpdateResult => ({
  ok: false,
  failure: { kind: 'error', error, status },
});
