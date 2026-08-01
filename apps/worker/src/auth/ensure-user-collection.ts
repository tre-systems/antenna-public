import { eq } from 'drizzle-orm';
import { PRODUCT_NAME } from '../brand';
import type { db } from '../db/client';
import { runD1Batch, type BatchStatement } from '../db/batch';
import { collections, connectorRequests, signals } from '../db/schema';

// Keep this starter collection id aligned with the seed migrations.
export const SEED_TEMPLATE_COLLECTION_ID = 'seed-dashboard';

const SIGNAL_INSERT_BATCH_SIZE = 5;

const DEFAULT_CONNECTOR_REQUESTS: ReadonlyArray<{ prompt: string; notes: string }> = [
  {
    prompt: 'https://finviz.com/',
    notes:
      'Daily collection screener: Finviz needs the exact saved screen, filters, columns, and source-rights review.',
  },
];

export const ensureUserCollection = async (
  client: ReturnType<typeof db>,
  userId: string,
  binding?: D1Database,
): Promise<void> => {
  const existing = await client
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .limit(1)
    .all();
  if (existing.length > 0) return;

  const now = new Date();
  const newCollectionId = crypto.randomUUID();
  await client
    .insert(collections)
    .values({
      id: newCollectionId,
      ownerId: userId,
      title: PRODUCT_NAME,
      layout: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  await cloneSeedSignals(client, newCollectionId, now, binding);
  await ensureDefaultConnectorRequests(client, newCollectionId, userId, now);
};

const cloneSeedSignals = async (
  client: ReturnType<typeof db>,
  targetCollectionId: string,
  now: Date,
  binding: D1Database | undefined,
): Promise<void> => {
  const source = await client
    .select()
    .from(signals)
    .where(eq(signals.collectionId, SEED_TEMPLATE_COLLECTION_ID))
    .all();
  if (source.length === 0) return;
  // Omit status and points so dispatch fills fresh data.
  const cloned = source.map((row) => ({
    ...row,
    id: crypto.randomUUID(),
    collectionId: targetCollectionId,
    createdAt: now,
    updatedAt: now,
  }));
  await insertSignalRows(client, cloned, binding);
};

const insertSignalRows = async (
  client: ReturnType<typeof db>,
  rows: ReadonlyArray<typeof signals.$inferInsert>,
  binding: D1Database | undefined,
): Promise<void> => {
  if (binding && (await runD1Batch(binding, rows.map(signalInsertStatement)))) return;

  for (let i = 0; i < rows.length; i += SIGNAL_INSERT_BATCH_SIZE) {
    await client
      .insert(signals)
      .values(rows.slice(i, i + SIGNAL_INSERT_BATCH_SIZE))
      .run();
  }
};

const signalInsertStatement = (row: typeof signals.$inferInsert): BatchStatement => ({
  sql: [
    'INSERT INTO signals',
    '(id, collection_id, template_id, title, config, refresh_seconds, position, visibility, created_at, updated_at)',
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
    row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
    row.updatedAt instanceof Date ? row.updatedAt.getTime() : row.updatedAt,
  ],
});

const ensureDefaultConnectorRequests = async (
  client: ReturnType<typeof db>,
  collectionId: string,
  userId: string,
  now: Date,
): Promise<void> => {
  const existing = await client
    .select({ prompt: connectorRequests.prompt })
    .from(connectorRequests)
    .where(eq(connectorRequests.collectionId, collectionId))
    .all();
  const existingPrompts = new Set(existing.map((row) => row.prompt));
  const missing = DEFAULT_CONNECTOR_REQUESTS.filter((req) => !existingPrompts.has(req.prompt));
  if (missing.length === 0) return;

  await client
    .insert(connectorRequests)
    .values(
      missing.map((req) => ({
        id: crypto.randomUUID(),
        collectionId,
        prompt: req.prompt,
        requestedBy: userId,
        notes: req.notes,
        status: 'requested' as const,
        createdAt: now,
      })),
    )
    .run();
};
