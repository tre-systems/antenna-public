import { appUsage } from '@antenna/connectors';
import { z } from 'zod';
import { numberField, stringField } from './config-fields';
import { type ConnectorTemplate } from './types';

// Deployment-owner telemetry from the shared app_usage dataset (docs/USAGE_RADAR.md).

const SLUG_RX = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ACCOUNT_ID_RX = /^[0-9a-f]{32}$/;

const extractProject = (prompt: string): string | undefined => {
  const match = /(?:usage|events|activity)\s+(?:for|of|on)\s+([a-z0-9][a-z0-9_-]{1,63})/i.exec(
    prompt,
  );
  return match?.[1]?.toLowerCase();
};

export const appUsageTemplate: ConnectorTemplate = {
  id: 'app-usage',
  displayName: 'App usage',
  configSchema: z.object({
    project: z.string().regex(SLUG_RX),
    account_id: z.string().regex(ACCOUNT_ID_RX),
    days: z.number().int().min(1).max(90).optional(),
    apiToken: z.string().optional(),
  }),
  paramKeys: ['project', 'account_id'] as const,
  matchHints: [
    /\bapp\s+usage\b/i,
    /\busage\s+(?:for|of)\s+[a-z0-9][a-z0-9_-]+/i,
    /\b(?:real\s+)?users?\s+(?:activity|events)\b/i,
    /\banalytics\s+engine\b/i,
  ],
  paramExtractors: {
    project: extractProject,
  },
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 3_600,
  pointRetentionDays: 90,
  serverSecret: {
    env: 'CF_ANALYTICS_API_TOKEN',
    configKey: 'apiToken',
    setupMessage:
      'Set CF_ANALYTICS_API_TOKEN (Cloudflare API token with Account Analytics Read) to enable app usage signals.',
  },
  adapter: (config) =>
    appUsage({
      project: stringField(config, 'project'),
      accountId: stringField(config, 'account_id'),
      apiToken: stringField(config, 'apiToken'),
      days: numberField(config, 'days'),
    }),
};
