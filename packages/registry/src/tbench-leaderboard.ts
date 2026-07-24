import { tbenchLeaderboard, type TbenchLeaderboardConfig } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const tbenchLeaderboardTemplate: ConnectorTemplate<TbenchLeaderboardConfig> = {
  id: 'tbench-leaderboard',
  displayName: 'Terminal Bench leaderboard',
  configSchema: z
    .object({
      version: z.string().trim().min(1).optional(),
      limit: z.number().int().positive().max(10).optional(),
    })
    .strict(),
  paramKeys: [] as const,
  matchHints: [
    /\bterminal[-\s]+bench\b/i,
    /\btbench\b/i,
    /\btbench\s+leaderboard\b/i,
    /\bai\s+agent\s+leaderboard\b/i,
    /\bagent\s+benchmark\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21600,
  adapter: (config) => tbenchLeaderboard(config),
};
