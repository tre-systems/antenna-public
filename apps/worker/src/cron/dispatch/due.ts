import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm';
import { signalStatus, collections, signals } from '../../db/schema';
import type { Client, Joined } from './types';

// Cap the adapter, D1, and Durable Object work produced by one tick.
export const DISPATCH_TICK_LIMIT = 250;

// Decide due state in SQL so callers receive only bounded due rows.
export const loadDueDispatchRows = async (
  client: Client,
  now: number,
  limit: number = DISPATCH_TICK_LIMIT,
): Promise<Joined[]> =>
  client
    .select({ signal: signals, collection: collections, status: signalStatus })
    .from(signals)
    .innerJoin(collections, eq(collections.id, signals.collectionId))
    .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
    .where(or(manualRefreshRequested(), scheduledAndElapsed(now)))
    .orderBy(asc(manualFirst()), asc(lastAttemptedAt()))
    .limit(limit)
    .all();

// Manual refreshes take priority, including for on-demand collections.
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
