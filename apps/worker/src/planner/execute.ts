import { and, eq, inArray } from 'drizzle-orm';
import { sourcePolicyForTemplate, templates } from '@antenna/registry';
import { db, type Env as DbEnv } from '../db/client';
import {
  signalStatus,
  signals as signalsTable,
  collections,
  collectionPlans,
  planConfirmationClaims,
  type SignalConfig,
  type ProposedPlan,
} from '../db/schema';
import type { ProposedSignal, Visibility } from '@antenna/shared';
import type { z } from 'zod';
import type { planConfirmSignalPatchSchema } from '@antenna/shared';
import { parsePlan } from './plan';
import { sourceLabelFor } from './sources';
import { runD1Batch, type BatchStatement } from '../db/batch';
import { validateTemplateConfig } from '../registry/config';
import { canReadSignalWithSourcePolicy } from '../policy/source-access';

type Client = ReturnType<typeof db>;
type MaterializedSignal = {
  readonly id: string;
  readonly signal: ProposedSignal;
  readonly position: number;
  readonly visibility: Visibility;
};

type ConfirmArgs = {
  readonly plan_id: string;
  readonly collection_id: string;
  readonly edited_signals?: ReadonlyArray<PlanConfirmSignalPatch>;
};

type PlanConfirmSignalPatch = z.infer<typeof planConfirmSignalPatchSchema>;

export const confirmPlan = async (
  env: DbEnv,
  args: ConfirmArgs,
): Promise<{ created_signal_ids: string[] }> => {
  const client = db(env);
  const row = await loadProposed(client, args.plan_id, args.collection_id);
  const collectionVisibility = await loadCollectionVisibility(client, row.collectionId);
  const plan = parsePlan(row.proposed, row.prompt);
  const signals = materializeSignals(plan.signals, args.edited_signals);

  const materialized: MaterializedSignal[] = [];
  let position = await nextPosition(client, row.collectionId);

  for (const signal of signals) {
    if (signal.missing.length > 0) continue;
    materialized.push({
      id: crypto.randomUUID(),
      signal,
      position,
      visibility: visibilityForNewSignal(signal.template_id, collectionVisibility),
    });
    position += 1;
  }

  await writeConfirmation(env.DB, client, args.plan_id, row.collectionId, materialized);

  return { created_signal_ids: materialized.map((signal) => signal.id) };
};

// Throws when the plan is missing or already resolved — confirmPlan is the
// only caller and surfaces this as a 4xx in the route layer.
const loadProposed = async (
  client: Client,
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

const loadCollectionVisibility = async (
  client: Client,
  collectionId: string,
): Promise<Visibility> => {
  const [row] = await client
    .select({ visibility: collections.visibility })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1)
    .all();
  if (!row) throw new Error('collection not found');
  return row.visibility;
};

const templateById = (templateId: string): (typeof templates)[number] | undefined =>
  templates.find((template) => template.id === templateId);

const materializeSignals = (
  proposedSignals: ReadonlyArray<ProposedSignal>,
  editedSignals: ReadonlyArray<PlanConfirmSignalPatch> | undefined,
): ProposedSignal[] =>
  proposedSignals.map((proposed, index) => sanitizeSignal(proposed, editedSignals?.[index]));

const sanitizeSignal = (
  proposed: ProposedSignal,
  edited: PlanConfirmSignalPatch | undefined,
): ProposedSignal => {
  const template = templateById(proposed.template_id);
  if (!template) throw new Error(`unknown template: ${proposed.template_id}`);

  const missing = new Set(proposed.missing);
  const config: Record<string, unknown> = { ...proposed.config };
  if (edited?.config) {
    for (const key of proposed.missing) {
      const value = edited.config[key];
      if (value !== undefined && value !== '') {
        config[key] = value;
        missing.delete(key);
      }
    }
  }

  const unresolved = [...missing];
  const validated = unresolved.length === 0 ? validateTemplateConfig(template, config) : config;

  return {
    template_id: template.id,
    display_name: template.displayName,
    config: validated,
    missing: unresolved,
    refresh_seconds: template.defaultRefreshSeconds,
    rights_status: template.rightsStatus,
    source_label: sourceLabelFor(template.id, template.displayName),
  };
};

const nextPosition = async (client: Client, collectionId: string): Promise<number> => {
  const rows = await client
    .select({ position: signalsTable.position })
    .from(signalsTable)
    .where(eq(signalsTable.collectionId, collectionId))
    .all();
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.position)) + 1;
};

const visibilityForNewSignal = (
  templateId: string,
  collectionVisibility: Visibility,
): Visibility => {
  if (collectionVisibility === 'private') return collectionVisibility;

  const policy = sourcePolicyForTemplate(templateId);
  const decision = canReadSignalWithSourcePolicy({
    collectionVisibility,
    signalVisibility: collectionVisibility,
    policy,
    audience: collectionVisibility === 'public' ? 'public' : 'shared_link',
  });
  // A source that cannot be exposed through the collection's shared/public
  // surface still belongs in the collection — it just stays private. The
  // shared-link and public read routes filter by signal visibility, so the
  // owner sees the signal and external audiences never do. Elevating it
  // later goes through the update route, which re-checks this policy.
  if (!decision.ok) return 'private';
  return collectionVisibility;
};

const writeConfirmation = async (
  binding: D1Database,
  client: Client,
  planId: string,
  collectionId: string,
  signals: ReadonlyArray<MaterializedSignal>,
): Promise<void> => {
  const now = new Date();
  const statements = [
    {
      sql: 'INSERT INTO plan_confirmation_claims (plan_id, claimed_at) VALUES (?, ?)',
      params: [planId, now.getTime()],
    },
    ...signals.flatMap((signal) => signalInsertStatements(collectionId, signal, now)),
    {
      sql: [
        'UPDATE collection_plans SET status = ?, resolved_at = ?',
        "WHERE id = ? AND status = 'proposed'",
      ].join(' '),
      params: ['confirmed', now.getTime(), planId],
    },
  ] satisfies BatchStatement[];

  if (await runD1Batch(binding, statements)) {
    return;
  }

  await client.insert(planConfirmationClaims).values({ planId, claimedAt: now }).run();
  try {
    for (const signal of signals) {
      await insertSignal(client, collectionId, signal, now);
    }

    await client
      .update(collectionPlans)
      .set({ status: 'confirmed', resolvedAt: now })
      .where(and(eq(collectionPlans.id, planId), eq(collectionPlans.status, 'proposed')))
      .run();
  } catch (error) {
    // The non-batch path exists for local/test adapters. Undo the claim so a
    // transient insert failure does not permanently strand a proposed plan or
    // leave partially materialised signals.
    if (signals.length > 0) {
      await client
        .delete(signalsTable)
        .where(
          inArray(
            signalsTable.id,
            signals.map((signal) => signal.id),
          ),
        )
        .run();
    }
    await client
      .delete(planConfirmationClaims)
      .where(eq(planConfirmationClaims.planId, planId))
      .run();
    throw error;
  }
};

const signalInsertStatements = (
  collectionId: string,
  materialized: MaterializedSignal,
  now: Date,
): [BatchStatement, BatchStatement] => [
  {
    sql: [
      'INSERT INTO signals',
      '(id, collection_id, template_id, title, config, refresh_seconds, position, visibility, created_at, updated_at)',
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ].join(' '),
    params: [
      materialized.id,
      collectionId,
      materialized.signal.template_id,
      materialized.signal.display_name,
      JSON.stringify(materialized.signal.config),
      materialized.signal.refresh_seconds,
      materialized.position,
      materialized.visibility,
      now.getTime(),
      now.getTime(),
    ],
  },
  {
    sql: 'INSERT INTO signal_status (signal_id, status, updated_at) VALUES (?, ?, ?)',
    params: [materialized.id, 'loading', now.getTime()],
  },
];

const insertSignal = async (
  client: Client,
  collectionId: string,
  materialized: MaterializedSignal,
  now: Date,
): Promise<void> => {
  await client
    .insert(signalsTable)
    .values({
      id: materialized.id,
      collectionId,
      templateId: materialized.signal.template_id,
      title: materialized.signal.display_name,
      // Same caveat as plan.ts: TEXT column, stringify manually.
      config: JSON.stringify(materialized.signal.config) as unknown as SignalConfig,
      refreshSeconds: materialized.signal.refresh_seconds,
      position: materialized.position,
      visibility: materialized.visibility,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  await client
    .insert(signalStatus)
    .values({
      signalId: materialized.id,
      status: 'loading',
      updatedAt: now,
    })
    .run();
};
