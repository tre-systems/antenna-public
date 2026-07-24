import { collectionTemplates, type CollectionTemplate } from '@antenna/registry';
import { collectionCreateSchema, type CollectionRecord } from '@antenna/shared';
import type { z } from 'zod';
import { db } from '../../db/client';
import { toCollectionRecord } from '../collection-record';
import { err } from '../http';
import { insertCollectionGraph } from './atomic-create';
import { createCollectionFromCommunityTemplate } from './community-templates';
import { COMMUNITY_TEMPLATE_ID_PREFIX } from './constants';
import { collectionQuotaError } from './quota';
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
  if (templateId?.startsWith(COMMUNITY_TEMPLATE_ID_PREFIX)) {
    return createCollectionFromCommunityTemplate(c, client, userId, templateId, parsed.data);
  }

  const collectionTemplate = resolveCollectionTemplate(templateId);
  if (!collectionTemplate.ok) return err(c, 'unknown_collection_template', 400);

  const row = newCollectionRow(parsed.data, userId, new Date());
  const templateRows = templateRowsForCollection(collectionTemplate.template, row);
  if (!templateRows.ok) return templateRowsFailure(c, templateRows);

  await insertTemplateRows(c.env.DB, client, row, templateRows);
  return c.json(toCollectionRecord(row) satisfies CollectionRecord, 201);
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
    return c.json({ error: result.error, reason: result.reason }, 409);
  }
  return err(c, result.error, 400);
};

const insertTemplateRows = async (
  binding: D1Database,
  client: Client,
  collection: CollectionRow,
  rows: TemplateRowsResult,
): Promise<void> => {
  if (!rows.ok) throw new Error('Expected materialized collection rows');
  await insertCollectionGraph(binding, client, collection, rows.signals, rows.statuses);
};
