import type { McpOAuthConnectionRecord } from '@antenna/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthVars } from '../auth/middleware';
import { runD1Batch } from '../db/batch';
import { db, type Env as DbEnv } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { oauthAccessToken, oauthApplication, oauthConsent } from '../db/schema';
import { err, ok } from './http';

type Bindings = DbEnv;

export const mcpConnectionsRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .get('/', async (c) => {
    const userId = c.get('user').id;
    const rows = await db(c.env)
      .select({
        clientId: oauthAccessToken.clientId,
        name: oauthApplication.name,
        scopes: oauthAccessToken.scopes,
        createdAt: oauthApplication.createdAt,
        updatedAt: oauthAccessToken.updatedAt,
        accessExpiresAt: oauthAccessToken.accessTokenExpiresAt,
        refreshExpiresAt: oauthAccessToken.refreshTokenExpiresAt,
      })
      .from(oauthAccessToken)
      .innerJoin(oauthApplication, eq(oauthApplication.clientId, oauthAccessToken.clientId))
      .where(
        and(
          eq(oauthAccessToken.userId, userId),
          gt(oauthAccessToken.refreshTokenExpiresAt, new Date()),
          eq(oauthApplication.disabled, false),
        ),
      )
      .orderBy(desc(oauthAccessToken.updatedAt))
      .all();

    return ok(c, groupConnections(rows));
  })
  .delete('/:clientId', async (c) => {
    const userId = c.get('user').id;
    const clientId = c.req.param('clientId');
    const client = db(c.env);
    const [ownedGrant] = await client
      .select({ id: oauthAccessToken.id })
      .from(oauthAccessToken)
      .where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)))
      .limit(1)
      .all();
    if (ownedGrant === undefined) return err(c, 'not_found', 404);

    const batched = await runD1Batch(c.env.DB, [
      {
        sql: 'DELETE FROM oauth_access_token WHERE user_id = ? AND client_id = ?',
        params: [userId, clientId],
      },
      {
        sql: 'DELETE FROM oauth_consent WHERE user_id = ? AND client_id = ?',
        params: [userId, clientId],
      },
    ]);
    if (!batched) {
      // Tests and local adapters may not expose D1 batch. Delete bearer grants
      // first so a partial failure cannot leave usable credentials behind.
      await client
        .delete(oauthAccessToken)
        .where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)))
        .run();
      await client
        .delete(oauthConsent)
        .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
        .run();
    }

    return ok(c, { disconnected: true, client_id: clientId, disconnected_at: Date.now() });
  });

type ConnectionRow = {
  readonly clientId: string;
  readonly name: string;
  readonly scopes: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
};

function groupConnections(rows: ReadonlyArray<ConnectionRow>): McpOAuthConnectionRecord[] {
  const records = new Map<string, McpOAuthConnectionRecord>();
  for (const row of rows) {
    const candidate = toRecord(row);
    const existing = records.get(row.clientId);
    if (existing === undefined) {
      records.set(row.clientId, candidate);
      continue;
    }
    records.set(row.clientId, {
      ...existing,
      created_at: Math.min(existing.created_at, candidate.created_at),
      last_refreshed_at: Math.max(existing.last_refreshed_at, candidate.last_refreshed_at),
      access_expires_at: Math.max(existing.access_expires_at, candidate.access_expires_at),
      refresh_expires_at: Math.max(existing.refresh_expires_at, candidate.refresh_expires_at),
      scopes: [...new Set([...existing.scopes, ...candidate.scopes])].sort(),
    });
  }
  return [...records.values()];
}

function toRecord(row: ConnectionRow): McpOAuthConnectionRecord {
  return {
    client_id: row.clientId,
    name: row.name.trim() || 'OAuth client',
    created_at: toTimestampMs(row.createdAt) ?? 0,
    last_refreshed_at: toTimestampMs(row.updatedAt) ?? 0,
    access_expires_at: toTimestampMs(row.accessExpiresAt) ?? 0,
    refresh_expires_at: toTimestampMs(row.refreshExpiresAt) ?? 0,
    scopes: [...new Set(row.scopes.split(/\s+/).filter(Boolean))].sort(),
  };
}
