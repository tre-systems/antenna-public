import { and, eq } from 'drizzle-orm';
import type { db } from '../db/client';
import { dismissedStarterSignals, signals } from '../db/schema';
import { SEED_TEMPLATE_COLLECTION_ID } from './ensure-user-collection';

// Gated on the seed collection still carrying a matching signal, so a user's own
// signals are never recorded as starter dismissals.
export const recordStarterSignalDismissal = async (
  client: ReturnType<typeof db>,
  collectionId: string,
  signal: typeof signals.$inferSelect,
  now: Date = new Date(),
): Promise<void> => {
  if (collectionId === SEED_TEMPLATE_COLLECTION_ID) return;
  const seedRows = await client
    .select({ id: signals.id })
    .from(signals)
    .where(
      and(
        eq(signals.collectionId, SEED_TEMPLATE_COLLECTION_ID),
        eq(signals.templateId, signal.templateId),
        eq(signals.config, signal.config),
      ),
    )
    .limit(1)
    .all();
  if (seedRows.length === 0) return;

  await client
    .insert(dismissedStarterSignals)
    .values({
      collectionId,
      signalSignature: signalSignature(signal),
      dismissedAt: now,
    })
    .onConflictDoNothing()
    .run();
};

const signalSignature = (signal: typeof signals.$inferSelect): string => {
  const config = typeof signal.config === 'string' ? signal.config : JSON.stringify(signal.config);
  return `${signal.templateId}|${config}`;
};
