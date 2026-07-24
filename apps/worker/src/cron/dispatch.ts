import { db } from '../db/client';
import { processDueSignal } from './dispatch/signal';
import { dueRows, loadDispatchRows } from './dispatch/due';
import { logDispatch } from './dispatch/log';
import type {
  Client,
  DispatchContext,
  DispatchEnv,
  DispatchSummary,
  Joined,
} from './dispatch/types';

export type { DispatchEnv, DispatchSummary } from './dispatch/types';

// Cron walks every due signal in the system. Per-user isolation is handled at
// read/write route boundaries; private auth resolution uses the owning
// collection's owner_id before any account-connected adapter runs.
export const runDispatch = async (env: DispatchEnv): Promise<DispatchSummary> => {
  const ctx: DispatchContext = { runId: crypto.randomUUID() };
  const client = db(env);
  const rows = await loadDispatchRows(client);
  const now = Date.now();
  const due = dueRows(rows, now);
  const counts = await dispatchRows(ctx, client, env, due, now);

  logDispatch({
    event: 'dispatch_tick_completed',
    run_id: ctx.runId,
    due: due.length,
    ok: counts.ok,
    failed: counts.failed,
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
  for (const row of rows) {
    if (await processDueSignal(ctx, client, env, row.signal, row.collection, now)) ok += 1;
    else failed += 1;
  }
  return { ok, failed };
};
