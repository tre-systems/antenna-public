import { and, eq } from 'drizzle-orm';
import { collectionLayoutSchema, type CollectionRecord } from '@antenna/shared';
import type { db } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { userCollectionVisits, type collections } from '../db/schema';

type Client = ReturnType<typeof db>;
type CollectionRow = typeof collections.$inferSelect;

type CollectionRecordOptions = {
  readonly lastSeenAt?: Date | null;
};

export const toCollectionRecord = (
  row: CollectionRow,
  options: CollectionRecordOptions = {},
): CollectionRecord => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  visibility: row.visibility,
  slug: row.slug ?? null,
  layout: parseLayout(row.layout),
  updated_at: toTimestampMs(row.updatedAt) ?? 0,
  ...(options.lastSeenAt !== undefined ? { last_seen_at: toTimestampMs(options.lastSeenAt) } : {}),
});

export const recordCollectionVisit = async (
  client: Client,
  userId: string,
  collectionId: string,
  now = new Date(),
): Promise<Date | null> => {
  const [existing] = await client
    .select({ lastSeenAt: userCollectionVisits.lastSeenAt })
    .from(userCollectionVisits)
    .where(
      and(
        eq(userCollectionVisits.userId, userId),
        eq(userCollectionVisits.collectionId, collectionId),
      ),
    )
    .limit(1)
    .all();

  await client
    .insert(userCollectionVisits)
    .values({ userId, collectionId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [userCollectionVisits.userId, userCollectionVisits.collectionId],
      set: { lastSeenAt: now },
    })
    .run();

  return existing?.lastSeenAt ?? null;
};

const parseLayout = (raw: unknown): CollectionRecord['layout'] => {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === 'string' ? parseJson(raw) : raw;
  const parsed = collectionLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
