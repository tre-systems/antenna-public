import { and, eq } from 'drizzle-orm';
import { collections, signals } from '../../db/schema';
import type { Client } from './types';

export const sameIdSet = (
  existing: ReadonlyArray<string>,
  proposed: ReadonlyArray<string>,
): boolean => {
  if (existing.length !== proposed.length) return false;
  const existingSet = new Set(existing);
  const proposedSet = new Set(proposed);
  return proposedSet.size === proposed.length && proposed.every((id) => existingSet.has(id));
};

export const persistCollectionSignalOrder = async (
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
