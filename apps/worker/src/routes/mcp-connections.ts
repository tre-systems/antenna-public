import type { McpOAuthConnectionRecord } from '@antenna/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthVars } from '../auth/middleware';
import { runD1Batch } from '../db/batch';
import { db, type Env as DbEnv } from '../db/client';
import { parseStringArray } from '../db/codecs';
import { oauthClient, oauth2AccessToken, oauth2RefreshToken, oauth2Consent } from '../db/schema';
import { err, ok } from './http';

export const mcpConnectionsRoute = new Hono<{ Bindings: DbEnv; Variables: AuthVars }>()
  .get('/', async (c) => {
    const rows = await db(c.env)
      .select({
        clientId: oauthClient.clientId,
        name: oauthClient.name,
        scopes: oauth2Consent.scopes,
        createdAt: oauth2Consent.createdAt,
        updatedAt: oauth2Consent.updatedAt,
        refreshedAt: oauth2RefreshToken.createdAt,
        refreshExpiresAt: oauth2RefreshToken.expiresAt,
      })
      .from(oauth2Consent)
      .innerJoin(oauthClient, eq(oauthClient.clientId, oauth2Consent.clientId))
      .leftJoin(
        oauth2RefreshToken,
        and(
          eq(oauth2RefreshToken.clientId, oauth2Consent.clientId),
          eq(oauth2RefreshToken.userId, oauth2Consent.userId),
        ),
      )
      .where(and(eq(oauth2Consent.userId, c.get('user').id), eq(oauthClient.disabled, false)))
      .orderBy(desc(oauth2Consent.updatedAt))
      .all();
    return ok(c, groupConnections(rows));
  })
  .delete('/:clientId', async (c) => {
    const userId = c.get('user').id,
      clientId = c.req.param('clientId');
    const client = db(c.env);
    const [owned] = await client
      .select({ id: oauth2Consent.id })
      .from(oauth2Consent)
      .where(and(eq(oauth2Consent.userId, userId), eq(oauth2Consent.clientId, clientId)))
      .limit(1)
      .all();
    if (!owned) return err(c, 'not_found', 404);
    const batched = await runD1Batch(
      c.env.DB,
      ['oauth2_consent', 'oauth2_access_token', 'oauth2_refresh_token'].map((table) => ({
        sql: `DELETE FROM ${table} WHERE user_id = ? AND client_id = ?`,
        params: [userId, clientId],
      })),
    );
    if (!batched) {
      // Consent IDs bind JWTs, so remove consent before deleting refresh credentials.
      await client
        .delete(oauth2Consent)
        .where(and(eq(oauth2Consent.userId, userId), eq(oauth2Consent.clientId, clientId)))
        .run();
      await client
        .delete(oauth2AccessToken)
        .where(and(eq(oauth2AccessToken.userId, userId), eq(oauth2AccessToken.clientId, clientId)))
        .run();
      await client
        .delete(oauth2RefreshToken)
        .where(
          and(eq(oauth2RefreshToken.userId, userId), eq(oauth2RefreshToken.clientId, clientId)),
        )
        .run();
    }
    return ok(c, { disconnected: true, client_id: clientId, disconnected_at: Date.now() });
  });

type ConnectionRow = {
  readonly clientId: string;
  readonly name: string | null;
  readonly scopes: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly refreshedAt: Date | null;
  readonly refreshExpiresAt: Date | null;
};

const groupConnections = (rows: ReadonlyArray<ConnectionRow>): McpOAuthConnectionRecord[] => {
  const records = new Map<string, McpOAuthConnectionRecord>();
  for (const row of rows) {
    const existing = records.get(row.clientId);
    records.set(row.clientId, {
      client_id: row.clientId,
      name: row.name?.trim() || 'OAuth client',
      created_at: Math.min(existing?.created_at ?? Infinity, row.createdAt.getTime()),
      last_refreshed_at: Math.max(
        existing?.last_refreshed_at ?? 0,
        row.updatedAt.getTime(),
        row.refreshedAt?.getTime() ?? 0,
      ),
      access_expires_at: null,
      refresh_expires_at: row.refreshExpiresAt
        ? Math.max(existing?.refresh_expires_at ?? 0, row.refreshExpiresAt.getTime())
        : (existing?.refresh_expires_at ?? null),
      scopes: [
        ...new Set([...(existing?.scopes ?? []), ...(parseStringArray(row.scopes) ?? [])]),
      ].sort(),
    });
  }
  return [...records.values()];
};
