import { projectPortfolio } from '@antenna/connectors';
import { z } from 'zod';
import { numberField, stringField } from './config-fields';
import { type ConnectorTemplate } from './types';

const ACCOUNT_ID_RX = /^[0-9a-f]{32}$/;
const PROJECTS_RX = /^[a-z0-9_-]+(?:,[a-z0-9_-]+)*$/;

export const projectPortfolioTemplate: ConnectorTemplate = {
  id: 'project-portfolio',
  displayName: 'Project portfolio',
  configSchema: z.object({
    projects: z.string().regex(PROJECTS_RX),
    account_id: z.string().regex(ACCOUNT_ID_RX),
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
