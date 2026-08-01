import { cloudflareWebAnalytics } from '@antenna/connectors';
import { z } from 'zod';
import { numberField, stringField } from './config-fields';
import { ACCOUNT_ID_PATTERN, HOST_LIST_PATTERN } from './config-patterns';
import { type ConnectorTemplate } from './types';

export const cloudflareWebAnalyticsTemplate: ConnectorTemplate = {
  id: 'cloudflare-web-analytics',
  displayName: 'Web visits',
  configSchema: z.object({
    account_id: z.string().regex(ACCOUNT_ID_PATTERN),
    hosts: z.string().regex(HOST_LIST_PATTERN),
    days: z.number().int().min(1).max(30).optional(),
    apiToken: z.string().optional(),
  }),
  paramKeys: ['account_id', 'hosts'] as const,
  matchHints: [/\bweb\s+(?:analytics|visits|traffic)\b/i, /\breal\s+browser\s+visits\b/i],
  paramExtractors: {},
  plannerEnabled: false,
  directProposalEnabled: true,
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 3_600,
  pointRetentionDays: 90,
  serverSecret: {
    env: 'CF_ANALYTICS_API_TOKEN',
    configKey: 'apiToken',
    setupMessage:
      'Set CF_ANALYTICS_API_TOKEN (Cloudflare Account Analytics Read) to enable Web Analytics signals.',
  },
  adapter: (config) =>
    cloudflareWebAnalytics({
      accountId: stringField(config, 'account_id'),
      hosts: stringField(config, 'hosts'),
      apiToken: stringField(config, 'apiToken'),
      days: numberField(config, 'days'),
    }),
};
