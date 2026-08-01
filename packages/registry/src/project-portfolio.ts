import { projectPortfolio } from '@antenna/connectors';
import { z } from 'zod';
import { numberField, stringField } from './config-fields';
import { ACCOUNT_ID_PATTERN, SLUG_LIST_PATTERN } from './config-patterns';
import { type ConnectorTemplate } from './types';

export const projectPortfolioTemplate: ConnectorTemplate = {
  id: 'project-portfolio',
  displayName: 'Project portfolio',
  configSchema: z.object({
    projects: z.string().regex(SLUG_LIST_PATTERN),
    account_id: z.string().regex(ACCOUNT_ID_PATTERN),
    days: z.number().int().min(1).max(30).optional(),
    apiToken: z.string().optional(),
  }),
  paramKeys: ['projects', 'account_id'] as const,
  matchHints: [/\bproject\s+portfolio\b/i, /\bactivity\s+across\s+(?:my\s+)?apps\b/i],
  paramExtractors: {},
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 3_600,
  pointRetentionDays: 90,
  serverSecret: {
    env: 'CF_ANALYTICS_API_TOKEN',
    configKey: 'apiToken',
    setupMessage:
      'Set CF_ANALYTICS_API_TOKEN (Cloudflare API token with Account Analytics Read) to enable the project portfolio.',
  },
  adapter: (config) =>
    projectPortfolio({
      projects: stringField(config, 'projects'),
      accountId: stringField(config, 'account_id'),
      apiToken: stringField(config, 'apiToken'),
      days: numberField(config, 'days'),
    }),
};
