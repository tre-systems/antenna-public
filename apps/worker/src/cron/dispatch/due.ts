import { and, asc, eq, lte, or, sql, type SQL } from 'drizzle-orm';
import { signalStatus, collections, signals } from '../../db/schema';
import type { Client, Joined } from './types';

// Cap the adapter, D1, and Durable Object work produced by one tick.
export const DISPATCH_TICK_LIMIT = 250;
export const OWNER_DISPATCH_TICK_LIMIT = 50;

// Decide due state in SQL so callers receive only bounded due rows.
export const loadDueDispatchRows = async (
  client: Client,
  now: number,
  limit: number = DISPATCH_TICK_LIMIT,
): Promise<Joined[]> => {
  const ranked = client.$with('ranked_due').as(
    client
      .select({
        id: signals.id,
        ownerRank: sql<number>`row_number() over (
        partition by ${collections.ownerId}
        order by ${manualFirst()}, ${lastAttemptedAt()}, ${signals.id}
      )`.as('owner_rank'),
        attemptedAt: lastAttemptedAt().as('attempted_at'),
      })
      .from(signals)
      .innerJoin(collections, eq(collections.id, signals.collectionId))
      .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
      .where(or(manualRefreshRequested(), scheduledAndElapsed(now))),
  );
  return client
    .with(ranked)
    .select({ signal: signals, collection: collections, status: signalStatus })
    .from(signals)
    .innerJoin(ranked, eq(ranked.id, signals.id))
    .innerJoin(collections, eq(collections.id, signals.collectionId))
    .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
    .where(lte(ranked.ownerRank, OWNER_DISPATCH_TICK_LIMIT))
    .orderBy(asc(ranked.ownerRank), asc(ranked.attemptedAt), asc(signals.id))
    .limit(limit)
    .all();
};

// Manual priority is confined to one owner's fair, bounded share of the tick.
const manualRefreshRequested = (): SQL =>
  sql`(${signalStatus.lastManualRequestAt} IS NOT NULL
       AND (${signalStatus.updatedAt} IS NULL
            OR ${signalStatus.lastManualRequestAt} > ${signalStatus.updatedAt}))`;

const scheduledAndElapsed = (now: number): SQL =>
  and(
    sql`${collections.refreshMode} <> 'on_demand'`,
    sql`(${signalStatus.signalId} IS NULL
         OR ((${signalStatus.nextAttemptAt} IS NULL OR ${signalStatus.nextAttemptAt} <= ${now})
             AND (${signalStatus.lastOkAt} IS NULL
                  OR ${now} - ${signalStatus.lastOkAt} >= ${signals.refreshSeconds} * 1000)))`,
  ) as SQL;

const manualFirst = (): SQL => sql`CASE WHEN ${manualRefreshRequested()} THEN 0 ELSE 1 END`;

// Order by oldest attempt so failures rotate instead of starving other signals.
const lastAttemptedAt = (): SQL => sql`COALESCE(${signalStatus.updatedAt}, 0)`;
