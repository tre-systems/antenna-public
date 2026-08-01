// Proxy an owner's collection stream from its Durable Object.

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, type Env as DbEnv } from '../db/client';
import { collections } from '../db/schema';
import type { AuthVars } from '../auth/middleware';
import { err } from './http';

type Bindings = DbEnv & {
  readonly CHANNELS?: DurableObjectNamespace;
};

export const streamRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>().get(
  '/:collectionId/stream',
  async (c) => {
    const channels = c.env.CHANNELS;
    if (!channels) return err(c, 'stream_unavailable', 503);

    const user = c.get('user');
    const collectionId = c.req.param('collectionId');
    const client = db(c.env);
    const [row] = await client
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.ownerId, user.id)))
      .limit(1)
      .all();
    if (!row) return err(c, 'no_collection', 404);

    const id = channels.idFromName(row.id);
    const stub = channels.get(id);
    // Return the Durable Object response verbatim to preserve streaming.
    return stub.fetch(collectionSubscriptionRequest(c.req.raw));
  },
);

export const collectionSubscriptionRequest = (incoming: Request): Request =>
  new Request('https://do/subscribe', { signal: incoming.signal });
