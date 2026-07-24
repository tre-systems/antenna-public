import { marketOverviewStooq } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const marketOverviewTemplate: ConnectorTemplate = {
  id: 'market-overview',
  displayName: 'Market overview',
  configSchema: z.object({}),
  paramKeys: [] as const,
  matchHints: [
    /\bmarket\s+overview\b/i,
    /\bmarket\s+sentiment\b/i,
    /\brisk[-\s]on\b/i,
    /\brisk[-\s]off\b/i,
    /\bfinviz\b/i,
    /\bhighest\s+level\s+market\b/i,
    /\bmarket\s+at\s+the\s+highest\s+level\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 1800,
  adapter: () => marketOverviewStooq({}),
};
