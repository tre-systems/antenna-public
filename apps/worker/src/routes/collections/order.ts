import { and, eq } from 'drizzle-orm';
import type { CollectionSignalOrderRecord } from '@antenna/shared';
import { runD1Batch, type BatchStatement } from '../../db/batch';
import { collections, signals } from '../../db/schema';
import { listCollectionSignalIds } from './repository';
import type { Client } from './types';

type ReorderResult =
  | { readonly ok: true; readonly record: CollectionSignalOrderRecord }
  | { readonly ok: false; readonly error: 'invalid_order_signals' };

// Accept only exact permutations of a collection's signal ids.
export const reorderCollectionSignalRows = async (
  client: Client,
  collectionId: string,
  orderedSignalIds: ReadonlyArray<string>,
  binding?: D1Database,
): Promise<ReorderResult> => {
  const existingIds = await listCollectionSignalIds(client, collectionId);
  if (!sameIdSet(existingIds, orderedSignalIds)) {
    return { ok: false, error: 'invalid_order_signals' };
  }

  await persistCollectionSignalOrder(client, collectionId, orderedSignalIds, new Date(), binding);
  return { ok: true, record: { updated: true, ordered_signal_ids: orderedSignalIds } };
};

const sameIdSet = (existing: ReadonlyArray<string>, proposed: ReadonlyArray<string>): boolean => {
  if (existing.length !== proposed.length) return false;
  const existingSet = new Set(existing);
  const proposedSet = new Set(proposed);
  return proposedSet.size === proposed.length && proposed.every((id) => existingSet.has(id));
};

// Batch reorders atomically, with a row-wise fallback for test adapters.
const persistCollectionSignalOrder = async (
  client: Client,
  collectionId: string,
  orderedSignalIds: ReadonlyArray<string>,
  now: Date,
  binding?: D1Database,
): Promise<void> => {
  if (
    binding &&
    (await runD1Batch(binding, orderStatements(collectionId, orderedSignalIds, now)))
  ) {
    return;
  }
  await persistOrderRowByRow(client, collectionId, orderedSignalIds, now);
};

const orderStatements = (
  collectionId: string,
  orderedSignalIds: ReadonlyArray<string>,
  now: Date,
): ReadonlyArray<BatchStatement> => [
  ...orderedSignalIds.map((id, position) => ({
    sql: 'UPDATE signals SET position = ?, updated_at = ? WHERE collection_id = ? AND id = ?',
    params: [position, now.getTime(), collectionId, id],
  })),
  {
    sql: 'UPDATE collections SET updated_at = ? WHERE id = ?',
    params: [now.getTime(), collectionId],
  },
];

const persistOrderRowByRow = async (
  client: Client,
  collectionId: string,
  orderedSignalIds: ReadonlyArray<string>,
  now: Date,
): Promise<void> => {
  for (const [position, id] of orderedSignalIds.entries()) {
    await client
      .update(signals)
      .set({ position, updatedAt: now })
      .where(and(eq(signals.collectionId, collectionId), eq(signals.id, id)))
      .run();
  }
  await client
    .update(collections)
    .set({ updatedAt: now })
    .where(eq(collections.id, collectionId))
    .run();
};
