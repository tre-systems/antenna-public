import { and, asc, eq, gte, type SQL } from 'drizzle-orm';
import { signalStatus, collections, signals, signalPoints } from '../../db/schema';
import { HISTORY_POINT_LIMIT, type HistoryRange, rangeToMs } from './constants';
import type { SignalRow, SignalWithStatus, Client } from './types';

export const listOwnedSignalRows = async (
  client: Client,
  userId: string,
  collectionId?: string,
): Promise<ReadonlyArray<SignalWithStatus>> => {
  const conditions = ownerConditions(userId, collectionId);
  return client
    .select({ signal: signals, status: signalStatus })
    .from(signals)
    .innerJoin(collections, eq(collections.id, signals.collectionId))
    .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
    .where(and(...conditions))
    .orderBy(asc(signals.collectionId), asc(signals.position))
    .all();
};

export const loadOwnedSignal = async (
  client: Client,
  userId: string,
  signalId: string,
): Promise<SignalRow | undefined> => {
  const row = await loadOwnedSignalRow(client, userId, signalId);
  return row?.signal;
};

export const loadOwnedSignalRow = async (
  client: Client,
  userId: string,
  signalId: string,
): Promise<SignalWithStatus | undefined> => {
  const [row] = await client
    .select({ signal: signals, status: signalStatus })
    .from(signals)
    .innerJoin(collections, eq(collections.id, signals.collectionId))
    .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
    .where(and(eq(signals.id, signalId), eq(collections.ownerId, userId)))
    .limit(1)
    .all();
  return row;
};

export const loadHistoryPoints = async (
  client: Client,
  signalId: string,
  range: HistoryRange,
): Promise<ReadonlyArray<typeof signalPoints.$inferSelect>> => {
  return client
    .select()
    .from(signalPoints)
    .where(historyPointFilter(signalId, range))
    .orderBy(asc(signalPoints.observedAt))
    .limit(HISTORY_POINT_LIMIT)
    .all();
};

const ownerConditions = (userId: string, collectionId?: string): SQL[] => {
  const conditions: SQL[] = [eq(collections.ownerId, userId)];
  if (collectionId !== undefined) {
    conditions.push(eq(collections.id, collectionId));
  }
  return conditions;
};

const historyPointFilter = (signalId: string, range: HistoryRange): SQL => {
  if (range === 'all') return eq(signalPoints.signalId, signalId);
  return and(
    eq(signalPoints.signalId, signalId),
    gte(signalPoints.observedAt, new Date(Date.now() - rangeToMs(range))),
  ) as SQL;
};
