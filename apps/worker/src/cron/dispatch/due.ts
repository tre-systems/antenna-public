import { eq } from 'drizzle-orm';
import { toTimestampMs } from '../../db/codecs';
import { signalStatus, collections, signals } from '../../db/schema';
import type { Client, Joined, StatusRow } from './types';

export const loadDispatchRows = async (client: Client): Promise<Joined[]> =>
  client
    .select({ signal: signals, collection: collections, status: signalStatus })
    .from(signals)
    .innerJoin(collections, eq(collections.id, signals.collectionId))
    .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
    .all();

export const dueRows = (rows: ReadonlyArray<Joined>, now: number): Joined[] =>
  rows.filter((row) => isDue(row, now));

const isDue = (row: Joined, now: number): boolean => {
  const status = row.status;
  if (status && hasManualRefreshRequest(status)) return true;
  if (row.collection.refreshMode === 'on_demand') return false;
  if (!status) return true;
  if (isWaitingForRetry(status, now)) return false;
  if (status.lastOkAt === null) return true;
  return hasRefreshIntervalElapsed(row, now);
};

const hasManualRefreshRequest = (status: StatusRow): boolean => {
  const manual = toTimestampMs(status.lastManualRequestAt);
  const attempt = toTimestampMs(status.updatedAt);
  return manual !== null && (attempt === null || manual > attempt);
};

const isWaitingForRetry = (status: StatusRow, now: number): boolean => {
  const nextAttempt = toTimestampMs(status.nextAttemptAt);
  return nextAttempt !== null && now < nextAttempt;
};

const hasRefreshIntervalElapsed = (row: Joined, now: number): boolean => {
  const intervalMs = row.signal.refreshSeconds * 1000;
  const lastOk = toTimestampMs(row.status?.lastOkAt ?? null) ?? 0;
  return now - lastOk >= intervalMs;
};
