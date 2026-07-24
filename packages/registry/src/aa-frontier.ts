import { aaFrontier, type AaFrontierConfig } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const aaFrontierTemplate: ConnectorTemplate<AaFrontierConfig> = {
  id: 'aa-frontier',
  displayName: 'Frontier model comparison',
  configSchema: z.object({ limit: z.number().int().positive().max(10).optional() }).strict(),
  paramKeys: [],
  matchHints: [/\bfrontier\s+(?:ai\s+)?models?\b/i, /\bmodel\s+cost.*speed.*intelligence\b/i],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  pointRetentionDays: 90,
  adapter: (config) => aaFrontier(config),
};
