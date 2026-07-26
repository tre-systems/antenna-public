import { yahooMarketHistory } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// Yahoo-style symbols can include digits and suffixes, e.g. `BA.L`,
// `0P000125KV.L`, `VTI`, `PII`.
const SYMBOL_RX = /\b([A-Z0-9]{1,12}(?:\.[A-Z]{1,3})?)\b/g;

const STOPWORDS = new Set([
  'I',
  'A',
  'AN',
  'THE',
  'AND',
  'OR',
  'TO',
  'AT',
  'IN',
  'ON',
  'FOR',
  'OF',
  'ETF',
  'API',
  'URL',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'BTC',
  'ETH',
]);

const extractSymbol = (prompt: string): string | undefined => {
  const matches = prompt.match(SYMBOL_RX) ?? [];
  for (const raw of matches) {
    const symbol = raw.toUpperCase();
    if (STOPWORDS.has(symbol)) continue;
    return symbol;
  }
  return undefined;
};

export const marketHistoryTemplate: ConnectorTemplate<{ symbol: string }> = {
  id: 'market-history',
  displayName: 'Market history',
  configSchema: z.object({
    symbol: z.string().min(1),
  }),
  paramKeys: ['symbol'] as const,
  matchHints: [
    /\b(?:chart|graph|history|historical|yearly|one[-\s]?year|1y|over\s+time|trend)\b/i,
    /\b(?:share\s+price|stock|ticker|etf|fund)\b/i,
  ],
  paramExtractors: {
    symbol: extractSymbol,
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  pointRetentionDays: 400,
  adapter: (config) => yahooMarketHistory({ symbol: config.symbol, range: '1y' }),
};
