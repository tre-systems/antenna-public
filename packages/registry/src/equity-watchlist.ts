import { equitiesStooq } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// 1-5 uppercase letters, optional `.US` / `.UK` style suffix. Conservative on
// purpose so we don't capture random uppercase tokens.
const TICKER_RX = /\b([A-Z]{1,5}(?:\.[A-Z]{2,3})?)\b/g;

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
  'FX',
  'AQI',
  'API',
  'REST',
  'URL',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
  'NZD',
  'BTC',
  'ETH',
  'SOL',
  'ADA',
  'DOGE',
]);

const extractTickers = (prompt: string): string | undefined => {
  const matches = prompt.match(TICKER_RX) ?? [];
  const tickers: string[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const sym = raw.toUpperCase();
    const head = sym.split('.')[0] ?? sym;
    if (STOPWORDS.has(head)) continue;
    // Stooq requires an exchange suffix; bare symbols default to the common case.
    const withSuffix = sym.includes('.') ? sym : `${sym}.US`;
    if (seen.has(withSuffix)) continue;
    seen.add(withSuffix);
    tickers.push(withSuffix);
  }
  return tickers.length === 0 ? undefined : tickers.join(',');
};

// paramExtractors may only return strings, so tickers round-trip via comma.
export const equityWatchlistTemplate: ConnectorTemplate<{ tickers: string }> = {
  id: 'equity-watchlist',
  displayName: 'Equity watchlist',
  configSchema: z.object({
    tickers: z.string().min(1),
  }),
  paramKeys: ['tickers'] as const,
  matchHints: [
    /\bstock\b/i,
    /\bstocks\b/i,
    /\bticker\b/i,
    /\bwatchlist\b/i,
    /\bequity\b/i,
    /\bshare\s+price\b/i,
  ],
  paramExtractors: {
    tickers: extractTickers,
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 600,
  adapter: (config) => equitiesStooq({ tickers: config.tickers.split(',') }),
};
