import {
  collectionSignalOrderUpdateSchema,
  collectionUpdateSchema,
  type CollectionSignalOrderRecord,
  type CollectionDeleteResponse,
  type CollectionRecord,
} from '@antenna/shared';
import type { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { collections, type CollectionLayout } from '../../db/schema';
import { toCollectionRecord } from '../collection-record';
import { err, ok } from '../http';
import { deleteCollectionTree } from './delete-tree';
import { persistCollectionSignalOrder, sameIdSet } from './order';
import { routeCollectionId } from './params';
import { collectionSlugForVisibility } from './slug';
import {
  layoutReferencesCollectionSignals,
  listCollectionSignals,
  listOwnedCollectionIds,
  loadOwnedCollection,
} from './repository';
import type { Client, CollectionRow, CollectionsContext } from './types';

export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;

export const reorderCollectionSignals = async (c: CollectionsContext): Promise<Response> => {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const parsed = collectionSignalOrderUpdateSchema.safeParse(raw);
  if (!parsed.success) return err(c, 'invalid_body', 400);

  const collectionId = routeCollectionId(c);
  const client = db(c.env);
  const collection = await loadOwnedCollection(client, c.get('user').id, collectionId);
  if (!collection) return err(c, 'not_found', 404);

  const existingIds = (await listCollectionSignals(client, collectionId)).map(
    (signal) => signal.id,
  );
  if (!sameIdSet(existingIds, parsed.data.ordered_signal_ids)) {
    return err(c, 'invalid_order_signals', 400);
  }

  await persistCollectionSignalOrder(
    client,
    collectionId,
    parsed.data.ordered_signal_ids,
    new Date(),
  );
  return ok(c, {
    updated: true,
    ordered_signal_ids: parsed.data.ordered_signal_ids,
  } satisfies CollectionSignalOrderRecord);
};

export const updateCollection = async (c: CollectionsContext): Promise<Response> => {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const parsed = collectionUpdateSchema.safeParse(raw);
  if (!parsed.success) return err(c, 'invalid_body', 400);

  const client = db(c.env);
  const row = await loadOwnedCollection(client, c.get('user').id, routeCollectionId(c));
  if (!row) return err(c, 'not_found', 404);

  if (parsed.data.layout !== undefined && parsed.data.layout !== null) {
    const validLayout = await layoutReferencesCollectionSignals(client, row.id, parsed.data.layout);
    if (!validLayout) return err(c, 'invalid_layout_signals', 400);
  }

  const updated = updatedCollectionRow(row, parsed.data, new Date());
  await persistCollectionUpdate(client, row.id, parsed.data, updated);
  return ok(c, toCollectionRecord(updated) satisfies CollectionRecord);
};

export const deleteCollection = async (c: CollectionsContext): Promise<Response> => {
  const collectionId = routeCollectionId(c);
  const client = db(c.env);
  const owned = await listOwnedCollectionIds(client, c.get('user').id);
  if (!owned.some((row) => row.id === collectionId)) return err(c, 'not_found', 404);
  if (owned.length <= 1) return err(c, 'last_collection', 409);

  await deleteCollectionTree(client, collectionId);
  return ok(c, { deleted: true, id: collectionId } satisfies CollectionDeleteResponse);
};

export const updatedCollectionRow = (
  row: CollectionRow,
  next: CollectionUpdateInput,
  now: Date,
): CollectionRow => {
  const visibility = next.visibility ?? row.visibility;
  return {
    ...row,
    title: next.title ?? row.title,
    description: next.description === undefined ? row.description : next.description,
    visibility,
    slug: collectionSlugForVisibility(row.visibility, row.slug, visibility),
    layout: next.layout === undefined ? row.layout : next.layout,
    updatedAt: now,
  };
};

export const persistCollectionUpdate = async (
  client: Client,
  collectionId: string,
  next: CollectionUpdateInput,
  updated: CollectionRow,
): Promise<void> => {
  await client
    .update(collections)
    .set({
      title: updated.title,
      description: updated.description,
      visibility: updated.visibility,
      slug: updated.slug,
      layout: next.layout === undefined ? undefined : serializeLayout(next.layout),
      updatedAt: updated.updatedAt,
    })
    .where(eq(collections.id, collectionId))
    .run();
};

const serializeLayout = (layout: CollectionUpdateInput['layout']): CollectionLayout | null => {
  return layout === null ? null : (JSON.stringify(layout) as unknown as CollectionLayout);
};
