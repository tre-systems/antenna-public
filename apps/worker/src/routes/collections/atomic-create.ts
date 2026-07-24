import { inArray } from 'drizzle-orm';
import { runD1Batch, type BatchStatement } from '../../db/batch';
import { collections, signalStatus, signals, type CollectionLayout } from '../../db/schema';
import type { Client, CollectionRow } from './types';

type SignalInsert = typeof signals.$inferInsert;
type StatusInsert = typeof signalStatus.$inferInsert;

export const insertCollectionGraph = async (
  binding: D1Database,
  client: Client,
  collection: CollectionRow,
  signalRows: ReadonlyArray<SignalInsert>,
  statusRows: ReadonlyArray<StatusInsert> = [],
): Promise<void> => {
  const statements = [
    collectionStatement(collection),
    ...signalRows.map(signalStatement),
    ...statusRows.map(statusStatement),
  ];
  if (await runD1Batch(binding, statements)) return;

  await client.insert(collections).values(collection).run();
  try {
    if (signalRows.length > 0)
      await client
        .insert(signals)
        .values([...signalRows])
        .run();
    if (statusRows.length > 0)
      await client
        .insert(signalStatus)
        .values([...statusRows])
        .run();
  } catch (error) {
    await rollbackGraph(client, collection.id, signalRows);
    throw error;
  }
};

const collectionStatement = (row: CollectionRow): BatchStatement => ({
  sql: [
    'INSERT INTO collections',
    '(id, owner_id, title, description, visibility, refresh_mode, slug,',
    'forked_from_collection_id, layout, created_at, updated_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' '),
  params: [
    row.id,
    row.ownerId,
    row.title,
    row.description,
    row.visibility,
    row.refreshMode,
    row.slug,
    row.forkedFromCollectionId,
    encodeLayout(row.layout),
    row.createdAt.getTime(),
    row.updatedAt.getTime(),
  ],
});

const signalStatement = (row: SignalInsert): BatchStatement => ({
  sql: [
    'INSERT INTO signals',
    '(id, collection_id, template_id, title, config, refresh_seconds, position,',
    'visibility, created_at, updated_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' '),
  params: [
    row.id,
    row.collectionId,
    row.templateId,
    row.title,
    typeof row.config === 'string' ? row.config : JSON.stringify(row.config),
    row.refreshSeconds,
    row.position,
    row.visibility ?? 'private',
    timestamp(row.createdAt),
    timestamp(row.updatedAt),
  ],
});

const statusStatement = (row: StatusInsert): BatchStatement => ({
  sql: 'INSERT INTO signal_status (signal_id, status, updated_at) VALUES (?, ?, ?)',
  params: [row.signalId, row.status, timestamp(row.updatedAt)],
});

const rollbackGraph = async (
  client: Client,
  collectionId: string,
  signalRows: ReadonlyArray<SignalInsert>,
): Promise<void> => {
  const signalIds = signalRows.map((row) => row.id);
  if (signalIds.length > 0) {
    await client.delete(signalStatus).where(inArray(signalStatus.signalId, signalIds)).run();
    await client.delete(signals).where(inArray(signals.id, signalIds)).run();
  }
  await client
    .delete(collections)
    .where(inArray(collections.id, [collectionId]))
    .run();
};

const timestamp = (value: Date | number): number =>
  value instanceof Date ? value.getTime() : value;

const encodeLayout = (layout: CollectionLayout | string | null): string | null => {
  if (layout === null || typeof layout === 'string') return layout;
  return JSON.stringify(layout);
};
