import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  publicCollectionReportSchema,
  type PublicCollectionListResponse,
  type PublicCollectionReportResponse,
  type PublicCollectionResponse,
} from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { signalStatus, signals, publicCollectionReports } from '../db/schema';
import { buildSignal, latestPointsForSignals } from './signals';
import { err, ok } from './http';
import {
  isPublicReadableSignal,
  loadPublicCollectionBySlug,
  requesterMetadataHash,
  toPublicSignal,
  toPublicCollectionRecord,
} from './public-collection-helpers';

// BETTER_AUTH_SECRET doubles as the HMAC key for hashing abuse-report requester
// metadata (see requesterMetadataHash). It's already required app-wide for auth.
type Bindings = DbEnv & { readonly BETTER_AUTH_SECRET: string };

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
  })
  .post('/:slug/report', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = publicCollectionReportSchema.safeParse(raw);
    if (!parsed.success) return err(c, 'invalid_body', 400);

    const client = db(c.env);
    const collection = await loadPublicCollectionBySlug(client, c.req.param('slug'));
    if (!collection) return err(c, 'not_found', 404);

    const now = new Date();
    const report = {
      id: crypto.randomUUID(),
      collectionId: collection.id,
      category: parsed.data.category,
      message: parsed.data.message ?? null,
      requesterHash: await requesterMetadataHash(c.req.raw, c.env.BETTER_AUTH_SECRET),
      createdAt: now,
    };
    await client.insert(publicCollectionReports).values(report).run();

    return c.json(
      {
        id: report.id,
        created_at: now.getTime(),
      } satisfies PublicCollectionReportResponse,
      201,
    );
  });
