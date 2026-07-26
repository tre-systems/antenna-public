import { Hono } from 'hono';
import { meOnboardingCompleteSchema, type MeResponse } from '@antenna/shared';
import { eq } from 'drizzle-orm';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { db, type Env as DbEnv } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { user as userTable } from '../db/schema';
import { countCollectionsForUser, collectionQuotaFromCount } from './quota';
import { err } from './http';

type Bindings = DbEnv;
type Client = ReturnType<typeof db>;

type UserMetadata = {
  readonly firstSeenAt: Date;
  readonly onboardedAt: Date | null;
  readonly image: string | null;
};

export const meRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .get('/', async (c) => {
    const sessionUser = c.get('user');
    const client = db(c.env);
    const [used, metadata] = await Promise.all([
      countCollectionsForUser(client, sessionUser.id),
      ensureUserMetadata(client, sessionUser, new Date()),
    ]);

    return c.json(toMeResponse(sessionUser, used, metadata));
  })
  .patch('/onboarding', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = meOnboardingCompleteSchema.safeParse(body);
    if (!parsed.success) return err(c, 'invalid_body', 400);

    const sessionUser = c.get('user');
    const client = db(c.env);
    const now = new Date();
    const metadata = await completeOnboarding(client, sessionUser, now);
    const used = await countCollectionsForUser(client, sessionUser.id);

    return c.json(toMeResponse(sessionUser, used, metadata));
  });

const ensureUserMetadata = async (
  client: Client,
  sessionUser: SessionUser,
  now: Date,
): Promise<UserMetadata> => {
  const [row] = await client
    .select({
      firstSeenAt: userTable.firstSeenAt,
      onboardedAt: userTable.onboardedAt,
      createdAt: userTable.createdAt,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, sessionUser.id))
    .limit(1)
    .all();

  if (!row) {
    await client
      .insert(userTable)
      .values({
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        emailVerified: true,
        image: sessionUser.image ?? null,
        createdAt: now,
        updatedAt: now,
        firstSeenAt: now,
        onboardedAt: null,
      })
      .onConflictDoNothing()
      .run();
    return { firstSeenAt: now, onboardedAt: null, image: sessionUser.image ?? null };
  }

  const firstSeenAt = row.firstSeenAt ?? row.createdAt;
  if (row.firstSeenAt === null) {
    await client
      .update(userTable)
      .set({ firstSeenAt, updatedAt: now })
      .where(eq(userTable.id, sessionUser.id))
      .run();
  }

  return { firstSeenAt, onboardedAt: row.onboardedAt, image: row.image };
};

const completeOnboarding = async (
  client: Client,
  sessionUser: SessionUser,
  now: Date,
): Promise<UserMetadata> => {
  const metadata = await ensureUserMetadata(client, sessionUser, now);
  if (metadata.onboardedAt !== null) return metadata;

  await client
    .update(userTable)
    .set({ onboardedAt: now, updatedAt: now })
    .where(eq(userTable.id, sessionUser.id))
    .run();

  return { ...metadata, onboardedAt: now };
};

const toMeResponse = (
  user: SessionUser,
  usedCollections: number,
  metadata: UserMetadata,
): MeResponse => ({
  id: user.id,
  email: user.email,
  name: user.name,
  image_url: user.image ?? metadata.image,
  first_seen_at: toTimestampMs(metadata.firstSeenAt) ?? 0,
  onboarded_at: toTimestampMs(metadata.onboardedAt),
  collection_quota: collectionQuotaFromCount(usedCollections),
});
