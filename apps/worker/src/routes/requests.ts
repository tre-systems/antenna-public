import { and, desc, eq, inArray, max, min, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { ConnectorRequestRecord } from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { connectorRequests, collections } from '../db/schema';
import { enrichConnectorRequest } from '../planner/setup-requests';
import type { AuthVars } from '../auth/middleware';
import { ok } from './http';

type Bindings = DbEnv;

const LIMIT = 100;

// Rows are per-occurrence; aggregate by fragment (stored in `prompt`) so the
// UI sees "this connector requested N times" without an extra table.
export const requestsRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>().get(
  '/',
  async (c) => {
    const userId = c.get('user').id;
    const client = db(c.env);
    const rows = await client
      .select({
        fragment: connectorRequests.prompt,
        count: sql<number>`count(*)`.as('count'),
        firstId: min(connectorRequests.id),
        firstNotes: min(connectorRequests.notes),
        firstAt: min(connectorRequests.createdAt),
        lastAt: max(connectorRequests.createdAt),
      })
      .from(connectorRequests)
      .innerJoin(collections, eq(collections.id, connectorRequests.collectionId))
      .where(
        and(
          eq(collections.ownerId, userId),
          inArray(connectorRequests.status, ['requested', 'building']),
        ),
      )
      .groupBy(connectorRequests.prompt)
      .orderBy(desc(sql`count`), desc(max(connectorRequests.createdAt)))
      .limit(LIMIT)
      .all();

    const records: ConnectorRequestRecord[] = rows.map((row) => {
      // `notes` holds the original prompt the fragment came from; fragment is
      // the canonical key when it's missing (e.g. legacy rows without notes).
      const prompt = row.firstNotes ?? row.fragment;
      return {
        id: row.firstId ?? row.fragment,
        fragment: row.fragment,
        prompt,
        ...enrichConnectorRequest(row.fragment, prompt),
        count: row.count,
        created_at: toTimestampMs(row.firstAt) ?? 0,
        updated_at: toTimestampMs(row.lastAt) ?? 0,
      };
    });

    return ok(c, records);
  },
);
