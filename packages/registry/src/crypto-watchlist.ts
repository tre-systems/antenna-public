import { cryptoCoinbase } from '@antenna/connectors';
import { z } from 'zod';
import { extractPairs } from './crypto-pairs';
import { type ConnectorTemplate } from './types';

// The contract requires paramExtractors to return a string, but cryptoCoinbase
// wants `{ pairs: string[] }`. We accept the comma-joined form and split here.
export const cryptoWatchlistTemplate: ConnectorTemplate<{ pairs: string }> = {
  id: 'crypto-watchlist',
  displayName: 'Crypto watchlist',
  configSchema: z.object({
    pairs: z.string().min(1),
  }),
  paramKeys: ['pairs'] as const,
  matchHints: [
    /\bbitcoin\b/i,
    /\bethereum\b/i,
    /\bcrypto\b/i,
    /\b(?:BTC|ETH|SOL|ADA|DOGE)\b/i,
    /\b[A-Z]{2,5}-USD\b/i,
  ],
  paramExtractors: {
    pairs: extractPairs,
  },
  rightsStatus: 'needs-review',
  defaultRefreshSeconds: 600,
  adapter: (config) => cryptoCoinbase({ pairs: config.pairs.split(',') }),
};
