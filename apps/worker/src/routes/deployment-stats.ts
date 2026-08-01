import { gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { collections, signals, user, userCollectionVisits } from '../db/schema';

// Return aggregate adoption counts without user identifiers.
type DeploymentStats = {
  readonly total_users: number;
  readonly new_users_24h: number;
  readonly new_users_7d: number;
  readonly active_users_7d: number;
  readonly collections: number;
  readonly signals: number;
};

const DAY_MS = 86_400_000;

export const readDeploymentStats = async (
  client: Db,
  now: number = Date.now(),
): Promise<DeploymentStats> => {
  const dayAgo = new Date(now - DAY_MS);
  const weekAgo = new Date(now - 7 * DAY_MS);

  const [totalUsers, newUsers24h, newUsers7d, activeUsers7d, totalCollections, totalSignals] =
    await Promise.all([
      countRows(client.select({ count: countExpr() }).from(user)),
      countRows(
        client.select({ count: countExpr() }).from(user).where(gte(user.createdAt, dayAgo)),
      ),
      countRows(
        client.select({ count: countExpr() }).from(user).where(gte(user.createdAt, weekAgo)),
      ),
      countRows(
        client
          .select({
            count: sql<number>`count(distinct ${userCollectionVisits.userId})`.as('count'),
          })
          .from(userCollectionVisits)
          .where(gte(userCollectionVisits.lastSeenAt, weekAgo)),
      ),
      countRows(client.select({ count: countExpr() }).from(collections)),
      countRows(client.select({ count: countExpr() }).from(signals)),
    ]);

  return {
    total_users: totalUsers,
    new_users_24h: newUsers24h,
    new_users_7d: newUsers7d,
    active_users_7d: activeUsers7d,
    collections: totalCollections,
    signals: totalSignals,
  };
};

const countExpr = () => sql<number>`count(*)`.as('count');

const countRows = async (query: {
  all: () => Promise<Array<{ count: number }>>;
}): Promise<number> => {
  const [row] = await query.all();
  return row?.count ?? 0;
};
