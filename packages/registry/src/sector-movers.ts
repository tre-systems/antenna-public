import { sectorMoversYahoo } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const sectorMoversTemplate: ConnectorTemplate = {
  id: 'sector-movers',
  displayName: 'US sector movers',
  configSchema: z.object({}),
  paramKeys: [] as const,
  matchHints: [
    /\bsector\s+heatmap\b/i,
    /\bmarket\s+heatmap\b/i,
    /\bsector\s+movers?\b/i,
    /\bmarket\s+movers?\b/i,
    /\bsectors?\s+today\b/i,
    /\bs(?:&|and)\s*p\s*sectors?\b/i,
    /\bsp\s*500\s*sectors?\b/i,
    /\bsector\s+performance\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 600,
  adapter: () => sectorMoversYahoo({}),
};
