import { signalStatus } from '../../db/schema';
import { toTimestampMs } from '../../db/codecs';
import {
  MANUAL_REFRESH_RATE_LIMIT_MS,
  MAX_REFRESH_SECONDS,
  MIN_REFRESH_SECONDS,
} from './constants';
import type { Client, StatusRow } from './types';

export type ManualRefreshRateLimit = {
  readonly retryAfterSeconds: number;
  readonly resetAtSeconds: number;
};

export const clampRefreshSeconds = (seconds: number): number =>
  Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, seconds));

export const manualRefreshRateLimit = (
  status: StatusRow | null,
  now: number,
): ManualRefreshRateLimit | undefined => {
  const lastManual = toTimestampMs(status === null ? null : status.lastManualRequestAt);
  if (lastManual === null) return undefined;

  const resetAt = lastManual + MANUAL_REFRESH_RATE_LIMIT_MS;
  if (now >= resetAt) return undefined;
  return {
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    resetAtSeconds: Math.ceil(resetAt / 1000),
  };
};

export const markManualRefreshRequested = async (
  client: Client,
  signalId: string,
  now: Date,
): Promise<void> => {
  await client
    .insert(signalStatus)
    .values({
      signalId,
      status: 'loading',
      lastManualRequestAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: signalStatus.signalId,
      // Dispatcher treats updatedAt as the last attempt marker.
      set: { lastManualRequestAt: now },
    })
    .run();
};
