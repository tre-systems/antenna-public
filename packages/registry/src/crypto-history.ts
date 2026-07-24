import { cryptoCoinbaseCandles } from '@antenna/connectors';
import { z } from 'zod';
import { extractPairs } from './crypto-pairs';
import { type ConnectorTemplate } from './types';

export const cryptoHistoryTemplate: ConnectorTemplate<{ pairs: string }> = {
  id: 'crypto-history',
  displayName: 'Crypto history',
  configSchema: z.object({
    pairs: z.string().min(1),
  }),
  paramKeys: ['pairs'] as const,
  matchHints: [
    /(?=.*\b(?:chart|graph|history|historical|yearly|one[-\s]?year|1y)\b)(?=.*\b(?:bitcoin|ethereum|crypto|BTC|ETH|SOL|ADA|DOGE)\b)/i,
  ],
  paramExtractors: {
    pairs: extractPairs,
  },
  rightsStatus: 'needs-review',
  defaultRefreshSeconds: 21_600,
  pointRetentionDays: 400,
  adapter: (config) => cryptoCoinbaseCandles({ pairs: config.pairs.split(','), days: 365 }),
};
