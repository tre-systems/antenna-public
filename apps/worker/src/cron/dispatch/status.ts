import type { AdapterError } from '@antenna/connectors';
import { eq } from 'drizzle-orm';
import { signalStatus } from '../../db/schema';
import { notifyCollection } from '../notify';
import { logEvent } from '../log';
import type { SignalRow, Client, DispatchContext, DispatchEnv, StatusRow } from './types';

type ErrorStatus = 'error' | 'stale';
type SignalStatusValue = typeof signalStatus.$inferInsert.status;
type StatusUpdate = {
  readonly status: SignalStatusValue;
  readonly lastOkAt?: Date;
  readonly lastError: string | null;
  readonly nextAttemptAt: Date | null;
  readonly updatedAt: Date;
};

export const readStatus = async (
  client: Client,
  signalId: string,
): Promise<StatusRow | undefined> => {
  const rows = await client
    .select()
    .from(signalStatus)
    .where(eq(signalStatus.signalId, signalId))
    .limit(1)
    .all();
  return rows[0];
};

export const markSignalStale = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  message: string,
  retryAfterSeconds: number,
): Promise<boolean> => {
  await writeStatus(client, signal.id, now, message, retryAfterSeconds, 'stale');
  await notifySignalError(ctx, env, signal, now, 'stale', message);
  return false;
};

export const failSignal = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  message: string,
  retryAfterSeconds?: number,
): Promise<boolean> => {
  const retry = retryAfterSeconds ?? retryDelayForMessage(message, signal.refreshSeconds);
  await writeStatus(client, signal.id, now, message, retry);
  await notifySignalError(ctx, env, signal, now, 'error', message);
  return false;
};

export const writeStatus = async (
  client: Client,
  signalId: string,
  now: number,
  errorMessage: string | null,
  retryAfterSeconds?: number,
  errorStatus: ErrorStatus = 'error',
): Promise<void> => {
  const values = statusValues(signalId, now, errorMessage, retryAfterSeconds, errorStatus);
  await client
    .insert(signalStatus)
    .values(values.insert)
    .onConflictDoUpdate({ target: signalStatus.signalId, set: values.update })
    .run();
};

const notifySignalError = async (
  ctx: DispatchContext,
  env: DispatchEnv,
  signal: SignalRow,
  now: number,
  status: ErrorStatus,
  message: string,
): Promise<void> => {
  await notifyCollection(env, signal.collectionId, {
    type: 'signal_error',
    signal_id: signal.id,
    fetched_at: now,
  });
  logSignalStatus(ctx, signal, status, message);
};

const logSignalStatus = (
  ctx: DispatchContext,
  signal: SignalRow,
  status: 'live' | ErrorStatus,
  error?: string,
): void => {
  logEvent({
    event: 'signal_dispatch_completed',
    run_id: ctx.runId,
    signal_id: signal.id,
    collection_id: signal.collectionId,
    template_id: signal.templateId,
    status,
    ...(error === undefined ? {} : { error }),
  });
};

const statusValues = (
  signalId: string,
  now: number,
  errorMessage: string | null,
  retryAfterSeconds: number | undefined,
  errorStatus: ErrorStatus,
) => {
  const isError = errorMessage !== null;
  const nowDate = new Date(now);
  const nextAttemptAt = nextAttemptDate(now, isError, retryAfterSeconds);
  return {
    insert: statusInsert(signalId, isError, errorStatus, nowDate, errorMessage, nextAttemptAt),
    update: statusUpdate(isError, errorStatus, nowDate, errorMessage, nextAttemptAt),
  };
};

const statusInsert = (
  signalId: string,
  isError: boolean,
  errorStatus: ErrorStatus,
  nowDate: Date,
  errorMessage: string | null,
  nextAttemptAt: Date | null,
): typeof signalStatus.$inferInsert => ({
  signalId,
  status: isError ? errorStatus : 'live',
  lastOkAt: isError ? null : nowDate,
  lastError: errorMessage,
  lastManualRequestAt: null,
  nextAttemptAt,
  updatedAt: nowDate,
});

const statusUpdate = (
  isError: boolean,
  errorStatus: ErrorStatus,
  nowDate: Date,
  errorMessage: string | null,
  nextAttemptAt: Date | null,
): StatusUpdate => ({
  status: isError ? errorStatus : 'live',
  ...(isError ? {} : { lastOkAt: nowDate }),
  lastError: errorMessage,
  nextAttemptAt,
  updatedAt: nowDate,
});

const nextAttemptDate = (
  now: number,
  isError: boolean,
  retryAfterSeconds: number | undefined,
): Date | null => {
  if (!isError || retryAfterSeconds === undefined) return null;
  return new Date(now + Math.max(1, retryAfterSeconds) * 1000);
};

const SETUP_RETRY_SECONDS = 6 * 60 * 60;
const AUTH_RETRY_SECONDS = 60 * 60;
const RATE_LIMIT_RETRY_SECONDS = 60 * 60;

export const retryDelayForAdapterError = (error: AdapterError, fallbackSeconds: number): number => {
  if (error.retryAfterSeconds !== undefined) return error.retryAfterSeconds;
  if (error.code === 'rate_limited') return RATE_LIMIT_RETRY_SECONDS;
  if (error.code === 'unauthorized') return AUTH_RETRY_SECONDS;
  return fallbackSeconds;
};

const retryDelayForMessage = (message: string, fallbackSeconds: number): number => {
  if (message.startsWith('setup_required:')) return SETUP_RETRY_SECONDS;
  if (message.startsWith('unauthorized:')) return AUTH_RETRY_SECONDS;
  if (message.startsWith('rate_limited:')) return RATE_LIMIT_RETRY_SECONDS;
  return fallbackSeconds;
};
