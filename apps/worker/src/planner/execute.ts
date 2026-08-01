import { eq } from 'drizzle-orm';
import type { ProposedSignal, Visibility } from '@antenna/shared';
import { db, type Db, type Env as DbEnv } from '../db/client';
import {
  collectionPlans,
  collections,
  planConfirmationClaims,
  signals,
  type ProposedPlan,
} from '../db/schema';
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

// Convert expected confirmation failures into result values at this boundary.
export type ConfirmPlanResult =
  | { readonly ok: true; readonly created_signal_ids: string[] }
  | {
      readonly ok: false;
      readonly error:
        | 'invalid_config'
        | 'not_found'
        | 'plan_already_resolved'
        | 'signal_quota_exceeded'
        | 'unknown_template';
      readonly detail?: string;
    };

export const confirmPlan = async (env: DbEnv, args: ConfirmArgs): Promise<ConfirmPlanResult> => {
  const client = db(env);
  const loaded = await loadProposed(client, args.plan_id, args.collection_id);
  if (!loaded.ok) return loaded;

  const collectionVisibility = await loadCollectionVisibility(client, loaded.row.collectionId);
  if (collectionVisibility === null) return { ok: false, error: 'not_found' };

  const plan = parsePlan(loaded.row.proposed, loaded.row.prompt);
  const proposed = materializeSignals(plan.signals, args.edited_signals);
  if (!proposed.ok) return proposed;

  return materializeConfirmation(
    env,
    client,
    args.plan_id,
    loaded.row.collectionId,
    collectionVisibility,
    proposed.signals,
  );
};

const materializeConfirmation = async (
  env: DbEnv,
  client: Db,
  planId: string,
  collectionId: string,
  collectionVisibility: Visibility,
  proposed: ReadonlyArray<ProposedSignal>,
): Promise<ConfirmPlanResult> => {
  const materialized: MaterializedSignal[] = [];
  let position = await nextPosition(client, collectionId);

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
  if (await wouldExceedSignalQuota(client, collectionId, materialized.length)) {
    return { ok: false, error: 'signal_quota_exceeded' };
  }

  try {
    await writeConfirmation(env.DB, client, planId, collectionId, materialized);
  } catch (caught) {
    if (await confirmationAlreadyClaimed(client, planId)) {
      return { ok: false, error: 'plan_already_resolved' };
    }
    throw caught;
  }

  return { ok: true, created_signal_ids: materialized.map((signal) => signal.id) };
};

type ProposedPlanRow = {
  readonly collectionId: string;
  readonly prompt: string;
  readonly proposed: ProposedPlan;
};

const loadProposed = async (
  client: Db,
  planId: string,
  collectionId: string,
): Promise<
  | { readonly ok: true; readonly row: ProposedPlanRow }
  | Extract<ConfirmPlanResult, { readonly ok: false }>
> => {
  const [row] = await client
    .select()
    .from(collectionPlans)
    .where(eq(collectionPlans.id, planId))
    .all();
  if (!row || row.collectionId !== collectionId) return { ok: false, error: 'not_found' };
  if (row.status !== 'proposed') return { ok: false, error: 'plan_already_resolved' };
  return {
    ok: true,
    row: { collectionId: row.collectionId, prompt: row.prompt, proposed: row.proposed },
  };
};

const loadCollectionVisibility = async (
  client: Db,
  collectionId: string,
): Promise<Visibility | null> => {
  const [row] = await client
    .select({ visibility: collections.visibility })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1)
    .all();
  return row?.visibility ?? null;
};

const confirmationAlreadyClaimed = async (client: Db, planId: string): Promise<boolean> => {
  const [claim] = await client
    .select({ planId: planConfirmationClaims.planId })
    .from(planConfirmationClaims)
    .where(eq(planConfirmationClaims.planId, planId))
    .limit(1)
    .all();
  return claim !== undefined;
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
