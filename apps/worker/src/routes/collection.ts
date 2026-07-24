import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  collectionSignalOrderUpdateSchema,
  collectionUpdateSchema,
  type CollectionSignalOrderRecord,
} from '@antenna/shared';
import { ensureUserCollection } from '../auth';
import type { AuthVars } from '../auth/middleware';
import { db, type Env as DbEnv } from '../db/client';
import { collections, signals } from '../db/schema';
import { recordCollectionVisit, toCollectionRecord } from './collection-record';
import { persistCollectionSignalOrder, sameIdSet } from './collections/order';
import { layoutReferencesCollectionSignals } from './collections/repository';
import { persistCollectionUpdate, updatedCollectionRow } from './collections/write-handlers';
import { err, ok } from './http';

export { recordCollectionVisit, toCollectionRecord } from './collection-record';

type Bindings = DbEnv;
type Client = ReturnType<typeof db>;
type CollectionRow = typeof collections.$inferSelect;

export const collectionRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .get('/', async (c) => {
    const client = db(c.env);
    const userId = c.get('user').id;
    const row = await loadOrCreateCollection(client, c.env.DB, userId);
    if (!row) return err(c, 'no_collection', 404);
    const previousVisit = await recordCollectionVisit(client, userId, row.id);
    return ok(c, toCollectionRecord(row, { lastSeenAt: previousVisit }));
  })
  .patch('/', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = collectionUpdateSchema.safeParse(raw);
    if (!parsed.success) return err(c, 'invalid_body', 400);

    const client = db(c.env);
    const row = await loadOrCreateCollection(client, c.env.DB, c.get('user').id);
    if (!row) return err(c, 'no_collection', 404);

    const next = parsed.data;
    if (next.layout !== undefined && next.layout !== null) {
      const validLayout = await layoutReferencesCollectionSignals(client, row.id, next.layout);
      if (!validLayout) return err(c, 'invalid_layout_signals', 400);
    }

    const updated = updatedCollectionRow(row, next, new Date());
    await persistCollectionUpdate(client, row.id, next, updated);

    return ok(c, toCollectionRecord(updated));
  })
  .patch('/signals/order', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = collectionSignalOrderUpdateSchema.safeParse(raw);
    if (!parsed.success) return err(c, 'invalid_body', 400);

    const client = db(c.env);
    const row = await loadOrCreateCollection(client, c.env.DB, c.get('user').id);
    if (!row) return err(c, 'no_collection', 404);

    const signalRows = await client
      .select({ id: signals.id })
      .from(signals)
      .where(eq(signals.collectionId, row.id))
      .orderBy(asc(signals.position))
      .all();
    const existingIds = signalRows.map((signal) => signal.id);
    if (!sameIdSet(existingIds, parsed.data.ordered_signal_ids)) {
      return err(c, 'invalid_order_signals', 400);
    }

    await persistCollectionSignalOrder(client, row.id, parsed.data.ordered_signal_ids, new Date());

    return ok(c, {
      updated: true,
      ordered_signal_ids: parsed.data.ordered_signal_ids,
    } satisfies CollectionSignalOrderRecord);
  });

const loadOrCreateCollection = async (
  client: Client,
  binding: D1Database,
  userId: string,
): Promise<CollectionRow | undefined> => {
  let row = await loadCollection(client, userId);
  if (row) return row;

  await ensureUserCollection(client, userId, binding);
  row = await loadCollection(client, userId);
  return row;
};

const loadCollection = async (
  client: Client,
  userId: string,
): Promise<CollectionRow | undefined> => {
  const [row] = await client
    .select()
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .limit(1)
    .all();
  return row;
};
