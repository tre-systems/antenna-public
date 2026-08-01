import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { type PublicCollectionListResponse, type PublicCollectionResponse } from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { signalStatus, signals } from '../db/schema';
import { buildSignal, latestPointsForSignals } from './signals';
import { err, ok } from './http';
import {
  isPublicReadableSignal,
  loadPublicCollectionBySlug,
  toPublicSignal,
  toPublicCollectionRecord,
} from './public-collection-helpers';

type Bindings = DbEnv;

export const publicCollectionsRoute = new Hono<{ Bindings: Bindings }>()
  .get('/', (c) => {
    return ok(c, {
      collections: [],
      next_offset: null,
    } satisfies PublicCollectionListResponse);
  })
  .get('/:slug', async (c) => {
    const client = db(c.env);
    const collection = await loadPublicCollectionBySlug(client, c.req.param('slug'));
    if (!collection) return err(c, 'not_found', 404);

    const rows = await client
      .select({ signal: signals, status: signalStatus })
      .from(signals)
      .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
      .where(eq(signals.collectionId, collection.id))
      .orderBy(asc(signals.position))
      .all();
    const visibleRows = rows.filter((row) => isPublicReadableSignal(row.signal));
    const latestPoints = await latestPointsForSignals(
      client,
      visibleRows.map((row) => row.signal.id),
    );
    const responseSignals = visibleRows.map((row) =>
      toPublicSignal(buildSignal(row.signal, row.status, latestPoints.get(row.signal.id) ?? [])),
    );

    return ok(c, {
      collection: toPublicCollectionRecord(
        collection,
        new Set(visibleRows.map((row) => row.signal.id)),
      ),
      signals: responseSignals,
    } satisfies PublicCollectionResponse);
  });
