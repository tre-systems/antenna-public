import { cloudflareAnalytics } from '@antenna/connectors';
import { z } from 'zod';
import { numberField, stringField } from './config-fields';
import { ACCOUNT_ID_PATTERN, SLUG_PATTERN } from './config-patterns';
import { type ConnectorTemplate } from './types';

// Fleet-wide Workers traffic with zero per-app instrumentation, via the owner's account token.

export const cloudflareAnalyticsTemplate: ConnectorTemplate = {
  id: 'cloudflare-analytics',
  displayName: 'Cloudflare traffic',
  configSchema: z.object({
    account_id: z.string().regex(ACCOUNT_ID_PATTERN),
    days: z.number().int().min(1).max(30).optional(),
    script: z.string().regex(SLUG_PATTERN).optional(),
    apiToken: z.string().optional(),
  }),
  paramKeys: ['account_id'] as const,
  matchHints: [
    /\bcloudflare\s+(?:traffic|analytics|requests|workers)\b/i,
    /\bworkers?\s+(?:traffic|analytics|requests)\b/i,
    /\b(?:app|worker)\s+fleet\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 3_600,
  pointRetentionDays: 90,
  serverSecret: {
    env: 'CF_ANALYTICS_API_TOKEN',
    configKey: 'apiToken',
    setupMessage:
      'Set CF_ANALYTICS_API_TOKEN (Cloudflare API token with Account Analytics Read) to enable Cloudflare traffic signals.',
  },
  adapter: (config) =>
    cloudflareAnalytics({
      accountId: stringField(config, 'account_id'),
      apiToken: stringField(config, 'apiToken'),
      days: numberField(config, 'days'),
      script: stringField(config, 'script') || undefined,
    }),
};
