import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm';
import { signalStatus, collections, signals } from '../../db/schema';
import type { Client, Joined } from './types';

// One tick's worth of work. The dispatcher runs every minute, so this caps the
// adapter fetches, D1 writes, and Durable Object notifies a single invocation
// can produce — independent of how many collections exist.
export const DISPATCH_TICK_LIMIT = 250;

// Due-ness is decided in SQL rather than by pulling every signal in the
// database into the isolate and filtering there. The predicate lives here and
// nowhere else, so callers take these rows as already-due.
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

// Someone is waiting on a manual refresh, so it jumps the scheduled queue and
// is honoured even for on-demand collections.
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

// Fairness key: least-recently-attempted first. `updated_at` advances on every
// attempt, success or failure, so a signal that keeps erroring rotates to the
// back of the queue rather than starving everyone else's. Never-attempted
// signals sort first.
const lastAttemptedAt = (): SQL => sql`COALESCE(${signalStatus.updatedAt}, 0)`;
