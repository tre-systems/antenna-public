import { eq, sql } from 'drizzle-orm';
import type { CollectionQuota } from '@antenna/shared';
import type { Db } from '../db/client';
import { collections, signals } from '../db/schema';

// Bound per-account cost and shared dispatch-queue occupancy.

const FREE_DASHBOARD_LIMIT = 10;

// Signals consume upstream, storage, and dispatch capacity on each refresh.
export const SIGNALS_PER_COLLECTION_LIMIT = 50;

const quotaFrom = (used: number, limit: number): CollectionQuota => ({
  used,
  limit,
  remaining: Math.max(0, limit - used),
  can_create: used < limit,
});

export const collectionQuotaFromCount = (
  used: number,
  limit = FREE_DASHBOARD_LIMIT,
): CollectionQuota => quotaFrom(used, limit);

export const signalQuotaFromCount = (
  used: number,
  limit = SIGNALS_PER_COLLECTION_LIMIT,
): CollectionQuota => quotaFrom(used, limit);

export const countCollectionsForUser = async (client: Db, userId: string): Promise<number> => {
  const [row] = await client
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .all();
  return row?.count ?? 0;
};

export const countSignalsInCollection = async (
  client: Db,
  collectionId: string,
): Promise<number> => {
  const [row] = await client
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(signals)
    .where(eq(signals.collectionId, collectionId))
    .all();
  return row?.count ?? 0;
};

// Check signal quota before writing to avoid partial batches.
export const wouldExceedSignalQuota = async (
  client: Db,
  collectionId: string,
  adding: number,
): Promise<boolean> => {
  if (adding <= 0) return false;
  const used = await countSignalsInCollection(client, collectionId);
  return used + adding > SIGNALS_PER_COLLECTION_LIMIT;
};
