import { z } from 'zod';

export const rightsStatusSchema = z.enum([
  'public',
  'with-attribution',
  'requires-auth',
  'needs-review',
]);

export const visibilitySchema = z.enum(['private', 'shared', 'public']);

export const sourceBlockerReasonSchema = z.enum([
  'irrelevant_request',
  'unsupported_source',
  'unsupported_symbol',
  'source_rights_blocked',
  'auth_required_source',
  'private_display_only_source',
  'unsafe_generated_extraction',
]);

export const sourceAcquisitionStateSchema = z.enum([
  'known_connector',
  'needs_credentials',
  'needs_source_review',
  'source_unavailable',
  'irrelevant_match',
  'generated_candidate',
]);

export const sourceAcquisitionStrategySchema = z.enum([
  'first_class_connector',
  'reviewed_catalog_reuse',
  'rss_atom',
  'public_api_json',
  'static_html_table',
  'embedded_page_json',
  'downloaded_report',
  'user_side_runner',
  'browser_session_setup',
  'manual_blocker',
]);

export const proposedSignalSchema = z.object({
  template_id: z.string().min(1),
  display_name: z.string(),
  config: z.record(z.string(), z.unknown()),
  missing: z.array(z.string()),
  refresh_seconds: z.number().int().positive(),
  rights_status: rightsStatusSchema,
  source_label: z.string(),
});

export const unmatchedHintSchema = z.object({
  fragment: z.string(),
  closest_template_id: z.string().optional(),
  blocker_reason: sourceBlockerReasonSchema.optional(),
  acquisition_state: sourceAcquisitionStateSchema.optional(),
  acquisition_strategy: sourceAcquisitionStrategySchema.optional(),
});

export const collectionPlanSchema = z.object({
  prompt: z.string(),
  signals: z.array(proposedSignalSchema),
  unmatched: z.array(unmatchedHintSchema),
});

export const planRequestSchema = z
  .object({
    prompt: z.string().min(1).max(2000),
    collection_id: z.string().trim().min(1).optional(),
  })
  .strict();

export const planConfirmSignalPatchSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const planConfirmSchema = z
  .object({
    edited_signals: z.array(planConfirmSignalPatchSchema).optional(),
  })
  .strict();

export const signalHistoryQuerySchema = z.object({
  range: z.enum(['1m', '3m', '6m', '1y', 'all']).default('1y'),
});

export const signalListQuerySchema = z.object({
  collection_id: z.string().trim().min(1).optional(),
});

export const publicCollectionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const publicCollectionReportSchema = z
  .object({
    category: z.enum(['broken', 'inappropriate', 'spam', 'other']),
    message: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const signalAlertsQuerySchema = z.object({
  collection_id: z.string().trim().min(1).optional(),
  since: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const notificationChannelSchema = z.enum(['daily_digest']);

export const notificationFrequencySchema = z.enum(['daily', 'weekly']);

const quietHourSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const notificationPreferenceQuerySchema = z.object({
  collection_id: z.string().trim().min(1).optional(),
});

export const notificationPreferencePatchSchema = z
  .object({
    collection_id: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    frequency: notificationFrequencySchema.optional(),
    quiet_hours_start: quietHourSchema.nullable().optional(),
    quiet_hours_end: quietHourSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.enabled !== undefined ||
      body.frequency !== undefined ||
      body.quiet_hours_start !== undefined ||
      body.quiet_hours_end !== undefined,
  );

export const meOnboardingCompleteSchema = z
  .object({
    completed: z.literal(true),
  })
  .strict();

export const signalUpdateSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).optional(),
    refresh_seconds: z.number().int().positive().optional(),
    visibility: visibilitySchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.config !== undefined ||
      body.refresh_seconds !== undefined ||
      body.visibility !== undefined,
  );

export const collectionLayoutSlotSchema = z.object({
  signal_id: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const collectionLayoutSchema = z.object({
  version: z.number().int().positive(),
  slots: z.array(collectionLayoutSlotSchema).max(200),
});

export const collectionUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    visibility: visibilitySchema.optional(),
    layout: collectionLayoutSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.title !== undefined ||
      body.description !== undefined ||
      body.visibility !== undefined ||
      body.layout !== undefined,
  );

export const collectionCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    visibility: visibilitySchema.optional(),
    template_id: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const collectionTemplatePublishSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    summary: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .default({});

export const collectionSignalOrderUpdateSchema = z
  .object({
    ordered_signal_ids: z.array(z.string().min(1)).min(1).max(200),
  })
  .strict()
  .refine((body) => new Set(body.ordered_signal_ids).size === body.ordered_signal_ids.length, {
    message: 'duplicate_signal_ids',
  });
