import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  notificationChannelSchema,
  notificationPreferencePatchSchema,
  notificationPreferenceQuerySchema,
  type NotificationChannel,
  type NotificationPreferenceRecord,
  type NotificationPreferenceResponse,
  type NotificationPreferencesResponse,
} from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import { db, type Env as DbEnv } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { collections, notificationPrefs } from '../db/schema';
import { err, ok } from './http';

type Bindings = DbEnv;

const GLOBAL_SCOPE = 'global';
const DASHBOARD_SCOPE_PREFIX = 'collection:';
const CHANNELS: readonly NotificationChannel[] = ['daily_digest'];

export const notificationsRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .get('/preferences', async (c) => {
    const parsed = notificationPreferenceQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return err(c, 'invalid_query', 400);

    const userId = c.get('user').id;
    const client = db(c.env);
    const scope = await resolveScope(client, userId, parsed.data.collection_id ?? null);
    if (!scope) return err(c, 'not_found', 404);

    const rows = await client
      .select()
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.scope, scope.key)))
      .all();
    const preferenceByChannel = new Map<NotificationChannel, typeof notificationPrefs.$inferSelect>(
      rows.map((row) => [row.channel, row]),
    );

    return ok(c, {
      preferences: CHANNELS.map((channel) =>
        toRecord(preferenceByChannel.get(channel), channel, scope.collectionId),
      ),
    } satisfies NotificationPreferencesResponse);
  })
  .patch('/preferences/:channel', async (c) => {
    const channel = notificationChannelSchema.safeParse(c.req.param('channel'));
    if (!channel.success) return err(c, 'invalid_channel', 400);

    const body: unknown = await c.req.json().catch(() => null);
    const parsed = notificationPreferencePatchSchema.safeParse(body);
    if (!parsed.success) return err(c, 'invalid_body', 400);

    const userId = c.get('user').id;
    const client = db(c.env);
    const scope = await resolveScope(client, userId, parsed.data.collection_id ?? null);
    if (!scope) return err(c, 'not_found', 404);

    const [existing] = await client
      .select()
      .from(notificationPrefs)
      .where(
        and(
          eq(notificationPrefs.userId, userId),
          eq(notificationPrefs.scope, scope.key),
          eq(notificationPrefs.channel, channel.data),
        ),
      )
      .limit(1)
      .all();

    const now = new Date();
    const next: typeof notificationPrefs.$inferInsert = {
      userId,
      scope: scope.key,
      collectionId: scope.collectionId,
      channel: channel.data,
      enabled: parsed.data.enabled ?? existing?.enabled ?? false,
      frequency: parsed.data.frequency ?? existing?.frequency ?? 'daily',
      quietHoursStart:
        parsed.data.quiet_hours_start === undefined
          ? (existing?.quietHoursStart ?? null)
          : parsed.data.quiet_hours_start,
      quietHoursEnd:
        parsed.data.quiet_hours_end === undefined
          ? (existing?.quietHoursEnd ?? null)
          : parsed.data.quiet_hours_end,
      updatedAt: now,
    };

    if (existing) {
      await client
        .update(notificationPrefs)
        .set({
          collectionId: next.collectionId,
          enabled: next.enabled,
          frequency: next.frequency,
          quietHoursStart: next.quietHoursStart,
          quietHoursEnd: next.quietHoursEnd,
          updatedAt: now,
        })
        .where(
          and(
            eq(notificationPrefs.userId, userId),
            eq(notificationPrefs.scope, scope.key),
            eq(notificationPrefs.channel, channel.data),
          ),
        )
        .run();
    } else {
      await client.insert(notificationPrefs).values(next).run();
    }

    return ok(c, {
      preference: toRecord(next, channel.data, scope.collectionId),
    } satisfies NotificationPreferenceResponse);
  });

type Client = ReturnType<typeof db>;

type PreferenceScope = {
  readonly key: string;
  readonly collectionId: string | null;
};

const resolveScope = async (
  client: Client,
  userId: string,
  collectionId: string | null,
): Promise<PreferenceScope | null> => {
  if (collectionId === null) return { key: GLOBAL_SCOPE, collectionId: null };

  const [collection] = await client
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, userId)))
    .limit(1)
    .all();
  if (!collection) return null;
  return { key: `${DASHBOARD_SCOPE_PREFIX}${collection.id}`, collectionId: collection.id };
};

const toRecord = (
  row: typeof notificationPrefs.$inferSelect | typeof notificationPrefs.$inferInsert | undefined,
  channel: NotificationChannel,
  collectionId: string | null,
): NotificationPreferenceRecord => ({
  collection_id: collectionId,
  channel,
  enabled: row?.enabled ?? false,
  frequency: row?.frequency ?? 'daily',
  quiet_hours_start: row?.quietHoursStart ?? null,
  quiet_hours_end: row?.quietHoursEnd ?? null,
  updated_at: row ? (toTimestampMs(row.updatedAt) ?? 0) : null,
});
