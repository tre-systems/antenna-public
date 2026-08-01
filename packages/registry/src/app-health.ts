import { appHealth } from '@antenna/connectors';
import { z } from 'zod';
import { stringField } from './config-fields';
import { SLUG_LIST_PATTERN } from './config-patterns';
import { type ConnectorTemplate } from './types';

export const appHealthTemplate: ConnectorTemplate = {
  id: 'app-health',
  displayName: 'App health',
  configSchema: z.object({
    projects: z.string().regex(SLUG_LIST_PATTERN),
    manifest: z.string().optional(),
  }),
  paramKeys: ['projects'] as const,
  matchHints: [/\bapp(?:lication)?\s+health\b/i, /\bproduction\s+health\b/i],
  paramExtractors: {},
  plannerEnabled: false,
  directProposalEnabled: true,
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 900,
  pointRetentionDays: 30,
  serverSecret: {
    env: 'APP_HEALTH_MANIFEST',
    configKey: 'manifest',
    setupMessage: 'Set APP_HEALTH_MANIFEST to the deployment-owned JSON map of app IDs to URLs.',
  },
  adapter: (config) =>
    appHealth({
      projects: stringField(config, 'projects'),
      manifest: stringField(config, 'manifest'),
    }),
};
