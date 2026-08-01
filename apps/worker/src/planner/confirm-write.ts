import { eq, inArray } from 'drizzle-orm';
import type { ProposedSignal, Visibility } from '@antenna/shared';
import { runD1Batch, type BatchStatement } from '../db/batch';
import type { Db } from '../db/client';
import {
  collectionPlans,
  planConfirmationClaims,
  signalStatus,
  signals,
  type SignalConfig,
} from '../db/schema';

export type MaterializedSignal = {
  readonly id: string;
  readonly signal: ProposedSignal;
  readonly position: number;
  readonly visibility: Visibility;
};

// Claim and materialize confirmation atomically when D1 batch support is available.
export const writeConfirmation = async (
  binding: D1Database,
  client: Db,
  planId: string,
  collectionId: string,
  materialized: ReadonlyArray<MaterializedSignal>,
): Promise<void> => {
  const now = new Date();
  const statements = [
    {
      sql: 'INSERT INTO plan_confirmation_claims (plan_id, claimed_at) VALUES (?, ?)',
      params: [planId, now.getTime()],
    },
    ...materialized.flatMap((signal) => signalInsertStatements(collectionId, signal, now)),
    {
      sql: 'UPDATE collection_plans SET status = ?, resolved_at = ? WHERE id = ?',
      params: ['confirmed', now.getTime(), planId],
    },
  ] satisfies BatchStatement[];

  if (await runD1Batch(binding, statements)) return;

  await client.insert(planConfirmationClaims).values({ planId, claimedAt: now }).run();
  try {
    for (const signal of materialized) {
      await insertSignal(client, collectionId, signal, now);
    }

    await client
      .update(collectionPlans)
      .set({ status: 'confirmed', resolvedAt: now })
      .where(eq(collectionPlans.id, planId))
      .run();
  } catch (error) {
    // Roll back fallback writes so partial failure does not strand the plan.
    await releaseClaim(client, planId, materialized);
    throw error;
  }
};

const releaseClaim = async (
  client: Db,
  planId: string,
  materialized: ReadonlyArray<MaterializedSignal>,
): Promise<void> => {
  if (materialized.length > 0) {
    await client
      .delete(signals)
      .where(
        inArray(
          signals.id,
          materialized.map((signal) => signal.id),
        ),
      )
      .run();
  }
  await client
    .delete(planConfirmationClaims)
    .where(eq(planConfirmationClaims.planId, planId))
    .run();
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
  client: Db,
  collectionId: string,
  materialized: MaterializedSignal,
  now: Date,
): Promise<void> => {
  await client
    .insert(signals)
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
