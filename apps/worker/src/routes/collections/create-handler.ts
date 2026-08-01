import { collectionTemplates, type CollectionTemplate } from '@antenna/registry';
import { collectionCreateSchema, type CollectionRecord } from '@antenna/shared';
import type { z } from 'zod';
import { db } from '../../db/client';
import { signalStatus, collections, signals } from '../../db/schema';
import { toCollectionRecord } from '../collection-record';
import { err, errWith } from '../http';
import { countCollectionsForUser, collectionQuotaFromCount } from '../quota';
import { newCollectionSlug } from './slug';
import {
  emptyTemplateRows,
  materializeCollectionTemplateSignals,
  type TemplateRowsResult,
} from './template-signals';
import type { Client, CollectionRow, CollectionsContext } from './types';

type TemplateLookup =
  { readonly ok: true; readonly template: CollectionTemplate | undefined } | { readonly ok: false };

export const createCollection = async (c: CollectionsContext): Promise<Response> => {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const parsed = collectionCreateSchema.safeParse(raw);
  if (!parsed.success) return err(c, 'invalid_body', 400);

  const client = db(c.env);
  const userId = c.get('user').id;
  const quotaError = await collectionQuotaError(c, client, userId);
  if (quotaError) return quotaError;

  const templateId = c.req.query('templateId') ?? parsed.data.template_id;
  const collectionTemplate = resolveCollectionTemplate(templateId);
  if (!collectionTemplate.ok) return err(c, 'unknown_collection_template', 400);

  const row = newCollectionRow(parsed.data, userId, new Date());
  const templateRows = templateRowsForCollection(collectionTemplate.template, row);
  if (!templateRows.ok) return templateRowsFailure(c, templateRows);

  await client.insert(collections).values(row).run();
  await insertTemplateRows(client, templateRows);
  return c.json(toCollectionRecord(row) satisfies CollectionRecord, 201);
};

// Refuse collection creation before writing when the account is at quota.
const collectionQuotaError = async (
  c: CollectionsContext,
  client: Client,
  userId: string,
): Promise<Response | undefined> => {
  const quota = collectionQuotaFromCount(await countCollectionsForUser(client, userId));
  return quota.can_create ? undefined : errWith(c, 'collection_quota_exceeded', { quota }, 409);
};

const resolveCollectionTemplate = (templateId: string | undefined): TemplateLookup => {
  if (templateId === undefined) return { ok: true, template: undefined };
  const template = collectionTemplates.find((candidate) => candidate.id === templateId);
  return template ? { ok: true, template } : { ok: false };
};

const newCollectionRow = (
  input: z.infer<typeof collectionCreateSchema>,
  userId: string,
  now: Date,
): CollectionRow => {
  const visibility = input.visibility ?? 'private';
  return {
    id: crypto.randomUUID(),
    ownerId: userId,
    title: input.title,
    description: input.description ?? null,
    visibility,
    refreshMode: 'scheduled',
    slug: visibility === 'private' ? null : newCollectionSlug(),
    forkedFromCollectionId: null,
    layout: null,
    createdAt: now,
    updatedAt: now,
  };
};

const templateRowsForCollection = (
  template: CollectionTemplate | undefined,
  row: CollectionRow,
): TemplateRowsResult => {
  return template === undefined
    ? emptyTemplateRows()
    : materializeCollectionTemplateSignals(template, row.id, row.visibility, row.createdAt);
};

const templateRowsFailure = (c: CollectionsContext, result: TemplateRowsResult): Response => {
  if (result.ok) throw new Error('Expected template row failure');
  if (result.error === 'source_policy_blocked') {
    return errWith(c, result.error, { reason: result.reason }, 409);
  }
  return err(c, result.error, 400);
};

const insertTemplateRows = async (client: Client, rows: TemplateRowsResult): Promise<void> => {
  if (!rows.ok || rows.signals.length === 0) return;
  await client.insert(signals).values(rows.signals).run();
  await client.insert(signalStatus).values(rows.statuses).run();
};
