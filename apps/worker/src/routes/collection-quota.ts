import { eq, sql } from 'drizzle-orm';
import type { CollectionQuota } from '@antenna/shared';
import type { Db } from '../db/client';
import { collections } from '../db/schema';

export const FREE_DASHBOARD_LIMIT = 10;

export const collectionQuotaFromCount = (
  used: number,
  limit = FREE_DASHBOARD_LIMIT,
): CollectionQuota => ({
  used,
  limit,
  remaining: Math.max(0, limit - used),
  can_create: used < limit,
});

export const countCollectionsForUser = async (client: Db, userId: string): Promise<number> => {
  const [row] = await client
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .all();
  return row?.count ?? 0;
};
