import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  signalStatus,
  collectionTemplatePublications,
  collections,
  signals,
  type CollectionLayout,
} from '../../db/schema';
import type { SignalRow, SignalWithStatus, Client, CollectionRow } from './types';

export const listOwnedCollections = (
  client: Client,
  userId: string,
): Promise<ReadonlyArray<CollectionRow>> => {
  return client
    .select()
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .orderBy(desc(collections.updatedAt))
    .all();
};

export const loadOwnedCollection = async (
  client: Client,
  userId: string,
  collectionId: string,
): Promise<CollectionRow | undefined> => {
  const [row] = await client
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, userId)))
    .limit(1)
    .all();
  return row;
};

export const listOwnedCollectionIds = (
  client: Client,
  userId: string,
): Promise<ReadonlyArray<{ readonly id: string }>> => {
  return client
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .all();
};

export const listCollectionSignals = (
  client: Client,
  collectionId: string,
): Promise<ReadonlyArray<SignalRow>> => {
  return client
    .select()
    .from(signals)
    .where(eq(signals.collectionId, collectionId))
    .orderBy(asc(signals.position))
    .all();
};

export const listCollectionSignalIds = async (
  client: Client,
  collectionId: string,
): Promise<ReadonlyArray<string>> => {
  const rows = await client
    .select({ id: signals.id })
    .from(signals)
    .where(eq(signals.collectionId, collectionId))
    .orderBy(asc(signals.position))
    .all();
  return rows.map((row) => row.id);
};

export const listCollectionSignalsWithStatus = (
  client: Client,
  collectionId: string,
): Promise<ReadonlyArray<SignalWithStatus>> => {
  return client
    .select({ signal: signals, status: signalStatus })
    .from(signals)
    .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
    .where(eq(signals.collectionId, collectionId))
    .orderBy(asc(signals.position))
    .all();
};

export const loadPublishedCollectionBySlug = async (
  client: Client,
  slug: string,
): Promise<CollectionRow | undefined> => {
  const [row] = await client
    .select({ collection: collections })
    .from(collectionTemplatePublications)
    .innerJoin(collections, eq(collections.id, collectionTemplatePublications.collectionId))
    .where(and(eq(collections.slug, slug), eq(collections.visibility, 'public')))
    .limit(1)
    .all();
  return row?.collection;
};

export const signalCountsForCollections = async (
  client: Client,
  collectionIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, number>> => {
  if (collectionIds.length === 0) return new Map();

  const rows = await client
    .select({ collectionId: signals.collectionId })
    .from(signals)
    .where(inArray(signals.collectionId, [...collectionIds]))
    .all();
  return countRowsByCollection(rows);
};

export const layoutReferencesCollectionSignals = async (
  client: Client,
  collectionId: string,
  layout: CollectionLayout,
): Promise<boolean> => {
  const referenced = Array.from(new Set(layout.slots.map((slot) => slot.signal_id)));
  if (referenced.length === 0) return true;

  const rows = await client
    .select({ id: signals.id })
    .from(signals)
    .where(and(eq(signals.collectionId, collectionId), inArray(signals.id, referenced)))
    .all();
  return rows.length === referenced.length;
};

const countRowsByCollection = (
  rows: ReadonlyArray<{ readonly collectionId: string }>,
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.collectionId, (counts.get(row.collectionId) ?? 0) + 1);
  }
  return counts;
};
