import type { CollectionLayout, signals as signalTable } from '../../db/schema';
import type { Visibility } from '../../policy/source-access';
import { toCollectionRecord } from '../collection-record';
import type { SignalRow, CollectionRow } from './types';
import { newCollectionSlug } from './slug';

type BuildForkRowsOptions = {
  readonly source: CollectionRow;
  readonly selectedSignals: ReadonlyArray<SignalRow>;
  readonly userId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly visibility: Visibility;
  readonly now: Date;
};

export type ForkRows = {
  readonly collection: CollectionRow;
  readonly signals: Array<typeof signalTable.$inferInsert>;
};

export const buildForkRows = (options: BuildForkRowsOptions): ForkRows => {
  const collectionId = crypto.randomUUID();
  const signalIdBySourceId = new Map<string, string>();
  const signalRows = copiedSignalRows(
    options.selectedSignals,
    collectionId,
    options.visibility,
    options.now,
    signalIdBySourceId,
  );
  const layout = forkLayout(options.source, signalIdBySourceId);

  return {
    collection: {
      id: collectionId,
      ownerId: options.userId,
      title: options.title,
      description:
        options.description === undefined ? options.source.description : options.description,
      visibility: options.visibility,
      refreshMode: 'scheduled',
      slug: options.visibility === 'private' ? null : newCollectionSlug(),
      forkedFromCollectionId: options.source.id,
      layout: layout === null ? null : (JSON.stringify(layout) as unknown as CollectionLayout),
      createdAt: options.now,
      updatedAt: options.now,
    },
    signals: signalRows,
  };
};

const copiedSignalRows = (
  sourceSignals: ReadonlyArray<SignalRow>,
  collectionId: string,
  visibility: Visibility,
  now: Date,
  signalIdBySourceId: Map<string, string>,
): Array<typeof signalTable.$inferInsert> => {
  return sourceSignals.map((signal, position) => {
    const id = crypto.randomUUID();
    signalIdBySourceId.set(signal.id, id);
    return copySignalRow(signal, id, collectionId, visibility, position, now);
  });
};

const copySignalRow = (
  signal: SignalRow,
  id: string,
  collectionId: string,
  visibility: Visibility,
  position: number,
  now: Date,
): typeof signalTable.$inferInsert => ({
  id,
  collectionId,
  templateId: signal.templateId,
  title: signal.title,
  config: signal.config,
  refreshSeconds: signal.refreshSeconds,
  position,
  visibility,
  createdAt: now,
  updatedAt: now,
});

const forkLayout = (
  source: CollectionRow,
  signalIdBySourceId: ReadonlyMap<string, string>,
): CollectionLayout | null => {
  const layout = toCollectionRecord(source).layout;
  if (!layout) return null;
  return {
    ...layout,
    slots: layout.slots.flatMap((slot) => {
      const signalId = signalIdBySourceId.get(slot.signal_id);
      return signalId ? [{ ...slot, signal_id: signalId }] : [];
    }),
  };
};
