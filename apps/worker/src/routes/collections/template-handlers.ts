import {
  collectionTemplatePublishSchema,
  type CollectionTemplatePublishRecord,
} from '@antenna/shared';
import type { z } from 'zod';
import { db } from '../../db/client';
import { collectionTemplatePublications } from '../../db/schema';
import { err, ok } from '../http';
import { toCommunityCollectionTemplateRecord } from './community-templates';
import { routeCollectionId } from './params';
import { listCollectionSignals, loadOwnedCollection } from './repository';
import { selectForkableSignals } from './source-policy';
import type {
  SignalRow,
  CollectionRow,
  CollectionTemplatePublicationRow,
  CollectionsContext,
} from './types';

export const publishCollectionTemplate = async (c: CollectionsContext): Promise<Response> => {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const parsed = collectionTemplatePublishSchema.safeParse(raw);
  if (!parsed.success) return err(c, 'invalid_body', 400);

  const client = db(c.env);
  const collection = await loadOwnedCollection(client, c.get('user').id, routeCollectionId(c));
  if (!collection) return err(c, 'not_found', 404);
  if (collection.visibility !== 'public' || collection.slug === null) {
    return err(c, 'collection_not_public', 409);
  }

  const selected = selectForkableSignals(
    await listCollectionSignals(client, collection.id),
    'private',
  );
  if (selected.signals.length === 0) {
    return c.json({ error: 'no_template_signals', skipped_signals: selected.skipped }, 409);
  }

  const publication = publicationRow(collection, selected.signals, parsed.data, c.get('user').id);
  await upsertPublication(client, publication);
  return ok(c, {
    template: toCommunityCollectionTemplateRecord(
      publication,
      collection,
      selected.signals,
      c.get('user').name,
    ),
    skipped_signals: selected.skipped,
  } satisfies CollectionTemplatePublishRecord);
};

const publicationRow = (
  collection: CollectionRow,
  signals: ReadonlyArray<SignalRow>,
  input: z.output<typeof collectionTemplatePublishSchema>,
  userId: string,
): CollectionTemplatePublicationRow => {
  const now = new Date();
  return {
    collectionId: collection.id,
    label: input.label ?? collection.title,
    description:
      input.description === undefined ? (collection.description ?? '') : (input.description ?? ''),
    summary:
      input.summary ??
      `${String(signals.length)} public signal${signals.length === 1 ? '' : 's'} from ${collection.title}`,
    publishedBy: userId,
    publishedAt: now,
    updatedAt: now,
  };
};

const upsertPublication = (
  client: ReturnType<typeof db>,
  publication: CollectionTemplatePublicationRow,
): Promise<unknown> => {
  return client
    .insert(collectionTemplatePublications)
    .values(publication)
    .onConflictDoUpdate({
      target: collectionTemplatePublications.collectionId,
      set: {
        label: publication.label,
        description: publication.description,
        summary: publication.summary,
        publishedBy: publication.publishedBy,
        updatedAt: publication.updatedAt,
      },
    })
    .run();
};
