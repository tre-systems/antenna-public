import { db } from '../db/client';
import { processDueSignal } from './dispatch/signal';
import { DISPATCH_TICK_LIMIT, loadDueDispatchRows } from './dispatch/due';
import { logEvent } from './log';
import type {
  Client,
  DispatchContext,
  DispatchEnv,
  DispatchSummary,
  Joined,
} from './dispatch/types';

export type { DispatchEnv, DispatchSummary } from './dispatch/types';

// Bound concurrent upstream calls and D1 write pressure.
const DISPATCH_CONCURRENCY = 8;

// Process due signals oldest-attempt first after resolving their owners.
export const runDispatch = async (env: DispatchEnv): Promise<DispatchSummary> => {
  const ctx: DispatchContext = { runId: crypto.randomUUID(), inFlight: new Map() };
  const client = db(env);
  const now = Date.now();
  const due = await loadDueDispatchRows(client, now);
  const counts = await dispatchRows(ctx, client, env, due, now);

  logEvent({
    event: 'dispatch_tick_completed',
    run_id: ctx.runId,
    due: due.length,
    ok: counts.ok,
    failed: counts.failed,
    // A saturated tick leaves oldest-attempt ordering for the next invocation.
    saturated: due.length >= DISPATCH_TICK_LIMIT,
  });
  return { ran: due.length, ...counts };
};

const dispatchRows = async (
  ctx: DispatchContext,
  client: Client,
  env: DispatchEnv,
  rows: ReadonlyArray<Joined>,
  now: number,
): Promise<Omit<DispatchSummary, 'ran'>> => {
  let ok = 0;
  let failed = 0;
  let next = 0;

  // Let each worker claim the next row so one slow adapter blocks only one lane.
  const worker = async (): Promise<void> => {
    for (let i = next++; i < rows.length; i = next++) {
      const row = rows[i];
      if (!row) continue;
      if (await processDueSignal(ctx, client, env, row.signal, row.collection, now)) ok += 1;
      else failed += 1;
    }
  };

  const lanes = Math.min(DISPATCH_CONCURRENCY, rows.length);
  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return { ok, failed };
};
