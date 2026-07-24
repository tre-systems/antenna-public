import { templates } from '@antenna/registry';
import type { CollectionRecord, CollectionTemplateRecord } from '@antenna/shared';
import { toCollectionRecord } from '../collection-record';
import { err } from '../http';
import { insertCollectionGraph } from './atomic-create';
import { COMMUNITY_TEMPLATE_ID_PREFIX } from './constants';
import { buildForkRows } from './fork-rows';
import { listCollectionSignals, loadPublishedCollectionBySlug } from './repository';
import { selectForkableSignals } from './source-policy';
import type {
  SignalRow,
  Client,
  CollectionCreateInput,
  CollectionRow,
  CollectionTemplatePublicationRow,
  CollectionsContext,
} from './types';

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

  const rows = buildForkRows({
    source,
    selectedSignals: selected.signals,
    userId,
    title: input.title,
    description: input.description,
    visibility: targetVisibility,
    now: new Date(),
  });
  await insertCollectionGraph(c.env.DB, client, rows.collection, rows.signals);

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
