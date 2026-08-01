import { and, eq } from 'drizzle-orm';
import { sourcePolicyForTemplate } from '@antenna/registry';
import type { CollectionRecord, PublicApiSignal, SignalStatus } from '@antenna/shared';
import type { Db } from '../db/client';
import { collections, type signals } from '../db/schema';
import { canReadSignalWithSourcePolicy } from '../policy/source-access';
import type { buildSignal } from './signals';
import { toCollectionRecord } from './collection-record';

type SignalRow = typeof signals.$inferSelect;
type CollectionRow = typeof collections.$inferSelect;

export const loadPublicCollectionBySlug = async (
  client: Db,
  slug: string,
): Promise<CollectionRow | undefined> => {
  const [row] = await client
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.visibility, 'public')))
    .limit(1)
    .all();
  return row;
};

export const isPublicReadableSignal = (signal: SignalRow): boolean => {
  const decision = canReadSignalWithSourcePolicy({
    collectionVisibility: 'public',
    signalVisibility: signal.visibility,
    policy: sourcePolicyForTemplate(signal.templateId),
    audience: 'public',
  });
  return decision.ok;
};

export const toPublicCollectionRecord = (
  collection: Parameters<typeof toCollectionRecord>[0],
  visibleSignalIds: ReadonlySet<string>,
): CollectionRecord => {
  const record = toCollectionRecord(collection);
  if (!record.layout) return record;
  return {
    ...record,
    layout: {
      ...record.layout,
      slots: record.layout.slots.filter((slot) => visibleSignalIds.has(slot.signal_id)),
    },
  };
};

// Keep raw adapter errors owner-only because they may contain provider details.
export const redactStatusForPublic = (status: SignalStatus): SignalStatus =>
  status.last_error === null ? status : { ...status, last_error: null };

export const toPublicSignal = (signal: ReturnType<typeof buildSignal>): PublicApiSignal => ({
  id: signal.id,
  template_id: signal.template_id,
  title: signal.title,
  visibility: signal.visibility,
  display: signal.display,
  source_policy: signal.source_policy ?? undefined,
  status: redactStatusForPublic(signal.status),
  points: signal.points,
});
