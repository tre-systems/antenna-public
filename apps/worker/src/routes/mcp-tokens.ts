import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import type { McpTokenRecord } from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import { db, type Env as DbEnv } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { mcpTokens } from '../db/schema';
import { err, ok } from './http';

type Bindings = DbEnv;

export const mcpTokensRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .get('/', async (c) => {
    const userId = c.get('user').id;
    const rows = await db(c.env)
      .select()
      .from(mcpTokens)
      .where(and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
      .orderBy(desc(mcpTokens.createdAt))
      .all();

    return ok(c, rows.map(toRecord));
  })
  .post('/', (c) => err(c, 'manual_tokens_disabled', 403))
  .delete('/:id', async (c) => {
    const userId = c.get('user').id;
    const id = c.req.param('id');
    const client = db(c.env);
    const [existing] = await client
      .select({ id: mcpTokens.id })
      .from(mcpTokens)
      .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
      .limit(1)
      .all();
    if (existing === undefined) return err(c, 'not_found', 404);

    const now = new Date();
    await client.update(mcpTokens).set({ revokedAt: now }).where(eq(mcpTokens.id, id)).run();

    return ok(c, { revoked: true, id, revoked_at: now.getTime() });
  });

function toRecord(row: typeof mcpTokens.$inferSelect): McpTokenRecord {
  return {
    id: row.id,
    label: row.label,
    created_at: toTimestampMs(row.createdAt) ?? 0,
    last_used_at: toTimestampMs(row.lastUsedAt),
    revoked_at: toTimestampMs(row.revokedAt),
  };
}
