import { templates } from '@antenna/registry';
import type { CollectionRecord, CollectionTemplateRecord } from '@antenna/shared';
import { collections, signals } from '../../db/schema';
import { toCollectionRecord } from '../collection-record';
import { err, errWith } from '../http';
import { buildForkRows } from './fork-rows';
import { listCollectionSignals, loadPublishedCollectionBySlug } from './repository';
import { selectForkableSignals } from './source-policy';
import { SIGNALS_PER_COLLECTION_LIMIT, signalQuotaFromCount } from '../quota';
import type {
  SignalRow,
  Client,
  CollectionCreateInput,
  CollectionRow,
  CollectionTemplatePublicationRow,
  CollectionsContext,
} from './types';

// Marks a template id as "fork this published collection" rather than a curated
// registry template.
export const COMMUNITY_TEMPLATE_ID_PREFIX = 'collection:';

export const createCollectionFromCommunityTemplate = async (
  c: CollectionsContext,
  client: Client,
  userId: string,
  templateId: string,
  input: CollectionCreateInput,
): Promise<Response> => {
  const source = await loadCommunityTemplateSource(client, templateId);
  if (!source) return err(c, 'unknown_collection_template', 400);

  const targetVisibility = input.visibility ?? 'private';
  const selected = selectForkableSignals(
    await listCollectionSignals(client, source.id),
    targetVisibility,
  );
  if (selected.signals.length === 0) {
    return c.json({ error: 'no_template_signals', skipped_signals: selected.skipped }, 409);
  }
  // Forking copies someone else's collection wholesale, so the source decides
  // how many signals land here. Hold it to the same limit as any other.
  if (selected.signals.length > SIGNALS_PER_COLLECTION_LIMIT) {
    return errWith(
      c,
      'signal_quota_exceeded',
      { quota: signalQuotaFromCount(selected.signals.length) },
      409,
    );
  }

  const rows = buildForkRows({
    source,
    selectedSignals: selected.signals,
    userId,
    title: input.title,
    description: input.description,
    visibility: targetVisibility,
    now: new Date(),
  });
  await client.insert(collections).values(rows.collection).run();
  await client.insert(signals).values(rows.signals).run();

  return c.json(toCollectionRecord(rows.collection) satisfies CollectionRecord, 201);
};

export const toCommunityCollectionTemplateRecord = (
  publication: CollectionTemplatePublicationRow,
  collection: CollectionRow,
  signals: ReadonlyArray<SignalRow>,
  ownerDisplayName: string,
): CollectionTemplateRecord => ({
  id: `${COMMUNITY_TEMPLATE_ID_PREFIX}${collection.slug ?? collection.id}`,
  kind: 'community',
  label: publication.label,
  description: publication.description ?? '',
  summary: publication.summary,
  source_collection_id: collection.id,
  fork_source_slug: collection.slug ?? '',
  owner_display_name: ownerDisplayName,
  signals: signals.map(templateSignalRecord),
});

const loadCommunityTemplateSource = async (
  client: Client,
  templateId: string,
): Promise<CollectionRow | undefined> => {
  const slug = templateId.slice(COMMUNITY_TEMPLATE_ID_PREFIX.length);
  return slug ? loadPublishedCollectionBySlug(client, slug) : undefined;
};

const templateSignalRecord = (signal: SignalRow): CollectionTemplateRecord['signals'][number] => {
  const connectorTemplate = templates.find((candidate) => candidate.id === signal.templateId);
  return {
    template_id: signal.templateId,
    display_name: connectorTemplate?.displayName ?? signal.templateId,
    title: signal.title,
  };
};
