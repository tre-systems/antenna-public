import { cloudflareAnalytics } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// Fleet-wide Cloudflare Workers traffic (requests, errors) with zero
// per-app instrumentation. Private-only: it reads the deployment owner's
// account analytics through an authenticated API token.

const ACCOUNT_ID_RX = /^[0-9a-f]{32}$/;

export const cloudflareAnalyticsTemplate: ConnectorTemplate = {
  id: 'cloudflare-analytics',
  displayName: 'Cloudflare traffic',
  configSchema: z.object({
    account_id: z.string().regex(ACCOUNT_ID_RX),
    days: z.number().int().min(1).max(30).optional(),
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
      accountId: typeof config.account_id === 'string' ? config.account_id : '',
      apiToken: typeof config.apiToken === 'string' ? config.apiToken : '',
      days: typeof config.days === 'number' ? config.days : undefined,
    }),
};
