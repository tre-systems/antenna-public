import { Hono } from 'hono';
import {
  collectionTemplates,
  publicDisplayBlockerForPolicy,
  sourcePolicyForTemplate,
  templates,
  type CollectionTemplate,
  type SourcePolicy,
} from '@antenna/registry';
import type {
  ApiSignalSourcePolicy,
  CollectionTemplateListResponse,
  CollectionTemplateRecord,
  TemplateRecord,
} from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import type { Env as DbEnv } from '../db/client';
import { ok } from './http';

type Bindings = DbEnv;

export const templatesRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .get('/collections', (c) => {
    return ok(c, {
      templates: collectionTemplates.map((template) => toCollectionTemplateRecord(template)),
    } satisfies CollectionTemplateListResponse);
  })
  .get('/', (c) => {
    return ok(
      c,
      templates.map((template) => toTemplateRecord(template)),
    );
  });

type Template = (typeof templates)[number];

const toTemplateRecord = (template: Template): TemplateRecord => ({
  id: template.id,
  display_name: template.displayName,
  param_keys: [...template.paramKeys],
  planner_enabled: template.plannerEnabled !== false,
  rights_status: template.rightsStatus,
  default_refresh_seconds: template.defaultRefreshSeconds,
  retain_raw_payload: template.retainRawPayload === true,
  server_secret_required: template.serverSecret !== undefined,
  setup_message: template.serverSecret?.setupMessage ?? null,
  source_policy: toSourcePolicyShape(sourcePolicyForTemplate(template.id)),
});

const toCollectionTemplateRecord = (template: CollectionTemplate): CollectionTemplateRecord => ({
  id: template.id,
  kind: 'curated',
  label: template.label,
  description: template.description,
  summary: template.summary,
  signals: template.signals.map((signal) => {
    const connectorTemplate = templates.find((candidate) => candidate.id === signal.templateId);
    return {
      template_id: signal.templateId,
      display_name: connectorTemplate?.displayName ?? signal.templateId,
      title: signal.title,
      config: signal.config,
      refresh_seconds: signal.refreshSeconds ?? connectorTemplate?.defaultRefreshSeconds ?? 900,
    };
  }),
});

const toSourcePolicyShape = (policy: SourcePolicy | undefined): ApiSignalSourcePolicy | null => {
  if (!policy) return null;
  return {
    source_id: policy.sourceId,
    label: policy.label,
    source_url: policy.sourceUrl,
    rights_status: policy.rightsStatus,
    execution_mode: policy.executionMode,
    public_display_eligible: policy.publicDisplayEligible,
    public_display_blocker: publicDisplayBlockerForPolicy(policy),
    attribution: policy.attribution,
    last_reviewed: policy.lastReviewed,
  };
};
