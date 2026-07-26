import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { sourcePolicyForTemplate } from '@antenna/registry';
import type { SharedCollectionResponse } from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { signalStatus, collections, signals } from '../db/schema';
import { canReadSharedLinkSignalWithSourcePolicy } from '../policy/source-access';
import { toPublicCollectionRecord, toPublicSignal } from './public-collection-helpers';
import { buildSignal, latestPointsForSignals } from './signals';
import { err, ok } from './http';

type Bindings = DbEnv;

export const sharedCollectionsRoute = new Hono<{ Bindings: Bindings }>().get(
  '/:slug',
  async (c) => {
    const slug = c.req.param('slug');
    const client = db(c.env);
    const [collection] = await client
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.visibility, 'shared')))
      .limit(1)
      .all();
    if (!collection) return err(c, 'not_found', 404);

    const rows = await client
      .select({ signal: signals, status: signalStatus })
      .from(signals)
      .leftJoin(signalStatus, eq(signalStatus.signalId, signals.id))
      .where(eq(signals.collectionId, collection.id))
      .orderBy(asc(signals.position))
      .all();
    const visibleRows = rows.filter((row) => {
      const decision = canReadSharedLinkSignalWithSourcePolicy({
        collectionVisibility: collection.visibility,
        signalVisibility: row.signal.visibility,
        policy: sourcePolicyForTemplate(row.signal.templateId),
      });
      return decision.ok;
    });
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
    } satisfies SharedCollectionResponse);
  },
);
