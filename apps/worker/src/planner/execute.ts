import { eq } from 'drizzle-orm';
import type { Visibility } from '@antenna/shared';
import { db, type Db, type Env as DbEnv } from '../db/client';
import { collectionPlans, collections, signals, type ProposedPlan } from '../db/schema';
import { wouldExceedSignalQuota } from '../routes/quota';
import {
  materializeSignals,
  visibilityForNewSignal,
  type PlanConfirmSignalPatch,
} from './confirm-signals';
import { writeConfirmation, type MaterializedSignal } from './confirm-write';
import { parsePlan } from './plan';

type ConfirmArgs = {
  readonly plan_id: string;
  readonly collection_id: string;
  readonly edited_signals?: ReadonlyArray<PlanConfirmSignalPatch>;
};

// Confirmation refuses for ordinary product reasons — the plan is gone, already
// resolved, over quota, or carries config the registry rejects. Helpers below
// still throw internally; this is the boundary that converts them to a value.
export type ConfirmPlanResult =
  | { readonly ok: true; readonly created_signal_ids: string[] }
  | { readonly ok: false; readonly error: string };

export const confirmPlan = async (env: DbEnv, args: ConfirmArgs): Promise<ConfirmPlanResult> => {
  try {
    return { ok: true, created_signal_ids: await materializeConfirmation(env, args) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : 'unknown_error' };
  }
};

const materializeConfirmation = async (env: DbEnv, args: ConfirmArgs): Promise<string[]> => {
  const client = db(env);
  const row = await loadProposed(client, args.plan_id, args.collection_id);
  const collectionVisibility = await loadCollectionVisibility(client, row.collectionId);
  const plan = parsePlan(row.proposed, row.prompt);
  const proposed = materializeSignals(plan.signals, args.edited_signals);

  const materialized: MaterializedSignal[] = [];
  let position = await nextPosition(client, row.collectionId);

  for (const signal of proposed) {
    if (signal.missing.length > 0) continue;
    materialized.push({
      id: crypto.randomUUID(),
      signal,
      position,
      visibility: visibilityForNewSignal(signal.template_id, collectionVisibility),
    });
    position += 1;
  }

  // Checked before the write so a plan never lands half-materialised.
  if (await wouldExceedSignalQuota(client, row.collectionId, materialized.length)) {
    throw new Error('signal_quota_exceeded');
  }

  await writeConfirmation(env.DB, client, args.plan_id, row.collectionId, materialized);

  return materialized.map((signal) => signal.id);
};

const loadProposed = async (
  client: Db,
  planId: string,
  collectionId: string,
): Promise<{
  readonly collectionId: string;
  readonly prompt: string;
  readonly proposed: ProposedPlan;
}> => {
  const [row] = await client
    .select()
    .from(collectionPlans)
    .where(eq(collectionPlans.id, planId))
    .all();
  if (!row || row.collectionId !== collectionId) throw new Error('plan not found');
  if (row.status !== 'proposed') throw new Error('plan already resolved');
  return { collectionId: row.collectionId, prompt: row.prompt, proposed: row.proposed };
};

const loadCollectionVisibility = async (client: Db, collectionId: string): Promise<Visibility> => {
  const [row] = await client
    .select({ visibility: collections.visibility })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1)
    .all();
  if (!row) throw new Error('collection not found');
  return row.visibility;
};

const nextPosition = async (client: Db, collectionId: string): Promise<number> => {
  const rows = await client
    .select({ position: signals.position })
    .from(signals)
    .where(eq(signals.collectionId, collectionId))
    .all();
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((row) => row.position)) + 1;
};
