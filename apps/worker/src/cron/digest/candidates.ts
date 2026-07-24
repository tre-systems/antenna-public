import { and, eq } from 'drizzle-orm';
import { collections, notificationPrefs, user as userTable } from '../../db/schema';
import { CHANNEL } from './constants';
import type { Candidate, Client, CollectionRow, PreferenceRow, UserRow } from './types';

type PreferenceWithUser = {
  readonly preference: PreferenceRow;
  readonly user: UserRow;
};

export const loadDigestCandidates = async (client: Client): Promise<readonly Candidate[]> => {
  const prefs = await loadPreferenceRows(client);
  const candidates = new Map<string, Candidate>();

  await addCollectionCandidates(client, candidates, prefs);
  await addGlobalCandidates(client, candidates, prefs);

  return [...candidates.values()];
};

const loadPreferenceRows = (client: Client): Promise<PreferenceWithUser[]> =>
  client
    .select({ preference: notificationPrefs, user: userTable })
    .from(notificationPrefs)
    .innerJoin(userTable, eq(userTable.id, notificationPrefs.userId))
    .where(and(eq(notificationPrefs.channel, CHANNEL), eq(notificationPrefs.enabled, true)))
    .all();

const addCollectionCandidates = async (
  client: Client,
  candidates: Map<string, Candidate>,
  prefs: readonly PreferenceWithUser[],
): Promise<void> => {
  for (const row of prefs.filter((row) => row.preference.collectionId !== null)) {
    await addCollectionCandidate(client, candidates, row);
  }
};

const addCollectionCandidate = async (
  client: Client,
  candidates: Map<string, Candidate>,
  row: PreferenceWithUser,
): Promise<void> => {
  const collectionId = row.preference.collectionId;
  if (collectionId === null) return;

  const collection = await loadOwnedCollection(client, row.user.id, collectionId);
  if (collection !== undefined) {
    candidates.set(candidateKey(row.user.id, collection.id), {
      user: row.user,
      collection,
      preference: row.preference,
    });
  }
};

const addGlobalCandidates = async (
  client: Client,
  candidates: Map<string, Candidate>,
  prefs: readonly PreferenceWithUser[],
): Promise<void> => {
  for (const row of prefs.filter((row) => row.preference.collectionId === null)) {
    const ownedCollections = await loadOwnedCollections(client, row.user.id);
    for (const collection of ownedCollections) addGlobalCandidate(candidates, row, collection);
  }
};

const addGlobalCandidate = (
  candidates: Map<string, Candidate>,
  row: PreferenceWithUser,
  collection: CollectionRow,
): void => {
  const key = candidateKey(row.user.id, collection.id);
  if (!candidates.has(key)) {
    candidates.set(key, { user: row.user, collection, preference: row.preference });
  }
};

const loadOwnedCollection = async (
  client: Client,
  ownerId: string,
  collectionId: string,
): Promise<CollectionRow | undefined> => {
  const [collection] = await client
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, ownerId)))
    .limit(1)
    .all();
  return collection;
};

const loadOwnedCollections = (client: Client, ownerId: string): Promise<CollectionRow[]> =>
  client.select().from(collections).where(eq(collections.ownerId, ownerId)).all();

const candidateKey = (userId: string, collectionId: string): string => `${userId}:${collectionId}`;
