import { githubTrending } from '@antenna/connectors';
import { z } from 'zod';
import { nonEmptyStringField } from './config-fields';
import { type ConnectorTemplate } from './types';

export const githubTrendingTemplate: ConnectorTemplate = {
  id: 'github-trending',
  displayName: 'GitHub Trending',
  configSchema: z.object({
    githubToken: z.string().optional(),
  }),
  paramKeys: [] as const,
  matchHints: [
    /\bgithub\b.*\btrending\b/i,
    /\btrending\b.*\bgithub\b/i,
    /\btrending\s+(?:repos?|repositories)\b/i,
    /\b(?:dev|developer)\s+tools?\b.*\btrending\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  adapter: (config) =>
    githubTrending({
      since: 'daily',
      limit: 5,
      githubToken: nonEmptyStringField(config, 'githubToken'),
    }),
};
