import type { CollectionDetailResponse, CollectionListResponse } from '@antenna/shared';
import { db } from '../../db/client';
import { buildSignal, latestPointsForSignals } from '../signals';
import { recordCollectionVisit, toCollectionRecord } from '../collection-record';
import { err, ok } from '../http';
import { routeCollectionId } from './params';
import {
  signalCountsForCollections,
  listCollectionSignalsWithStatus,
  listOwnedCollections,
  loadOwnedCollection,
} from './repository';
import type { CollectionRow, CollectionsContext } from './types';

export const listCollections = async (c: CollectionsContext): Promise<Response> => {
  const client = db(c.env);
  const rows = await listOwnedCollections(client, c.get('user').id);
  const signalCounts = await signalCountsForCollections(
    client,
    rows.map((row) => row.id),
  );

  return ok(c, {
    collections: rows.map((row) => collectionListItem(row, signalCounts.get(row.id) ?? 0)),
  } satisfies CollectionListResponse);
};

export const getCollection = async (c: CollectionsContext): Promise<Response> => {
  const collectionId = routeCollectionId(c);
  const client = db(c.env);
  const collection = await loadOwnedCollection(client, c.get('user').id, collectionId);
  if (!collection) return err(c, 'not_found', 404);

  const rows = await listCollectionSignalsWithStatus(client, collectionId);
  const latestPoints = await latestPointsForSignals(
    client,
    rows.map((row) => row.signal.id),
  );
  const previousVisit = await recordCollectionVisit(client, c.get('user').id, collection.id);

  return ok(c, {
    collection: toCollectionRecord(collection, { lastSeenAt: previousVisit }),
    signals: rows.map((row) =>
      buildSignal(row.signal, row.status, latestPoints.get(row.signal.id) ?? []),
    ),
  } satisfies CollectionDetailResponse);
};

const collectionListItem = (row: CollectionRow, signalCount: number) => {
  const record = toCollectionRecord(row);
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    visibility: record.visibility,
    slug: record.slug,
    updated_at: record.updated_at,
    signal_count: signalCount,
  };
};
