import type { DataPoint } from './types';

export type MarketProxy = {
  readonly ticker: string;
  readonly label: string;
  readonly role: 'equity' | 'growth' | 'small_cap' | 'bond' | 'gold' | 'oil' | 'dollar';
};

export type Quote = MarketProxy & {
  readonly open: number;
  readonly close: number;
  readonly changePct: number;
  readonly ts: number;
  readonly sourceUrl: string;
};

export const PROXIES: ReadonlyArray<MarketProxy> = [
  { ticker: 'VTI.US', label: 'US equities', role: 'equity' },
  { ticker: 'QQQ.US', label: 'US growth', role: 'growth' },
  { ticker: 'IWM.US', label: 'Small caps', role: 'small_cap' },
  { ticker: 'TLT.US', label: 'Long bonds', role: 'bond' },
  { ticker: 'GLD.US', label: 'Gold', role: 'gold' },
  { ticker: 'USO.US', label: 'Oil', role: 'oil' },
  { ticker: 'UUP.US', label: 'US dollar', role: 'dollar' },
];

export const parseProxyCsv = (proxy: MarketProxy, csv: string): Quote | null => {
  const row = csv
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[1]
    ?.split(',');
  if (!row) return null;
  const symbol = row[0];
  const date = row[1];
  const time = row[2];
  const open = Number(row[3]);
  const close = Number(row[6]);
  if (
    !symbol ||
    symbol === 'N/D' ||
    !Number.isFinite(open) ||
    !Number.isFinite(close) ||
    open === 0
  ) {
    return null;
  }
  return {
    ...proxy,
    open,
    close,
    changePct: ((close - open) / open) * 100,
    ts: parseTs(date, time),
    sourceUrl: quotePageUrl(proxy.ticker),
  };
};

export const assessMarket = (
  quotes: ReadonlyArray<Quote>,
): {
  readonly regime: 'Risk-on' | 'Risk-off' | 'Mixed' | 'Quiet';
  readonly score: number;
  readonly positive: number;
  readonly negative: number;
} => {
  let score = 0;
  let positive = 0;
  let negative = 0;
  for (const quote of quotes) {
    const sign = quote.changePct > 0.25 ? 1 : quote.changePct < -0.25 ? -1 : 0;
    if (sign > 0) positive += 1;
    if (sign < 0) negative += 1;
    const defensive = quote.role === 'bond' || quote.role === 'gold' || quote.role === 'dollar';
    score += defensive ? -sign : sign;
  }
  return { regime: marketRegime(score, positive, negative), score, positive, negative };
};

export const proxyChangePoint = (quote: Quote): DataPoint => ({
  dimensions: {
    metric: 'market_proxy_change',
    ticker: quote.ticker,
    label: quote.label,
    role: quote.role,
  },
  value: round2(quote.changePct),
  unit: '%',
  ts: quote.ts,
  sourceUrl: quote.sourceUrl,
});

const marketRegime = (
  score: number,
  positive: number,
  negative: number,
): 'Risk-on' | 'Risk-off' | 'Mixed' | 'Quiet' => {
  if (Math.abs(score) <= 1 && positive + negative <= 3) return 'Quiet';
  if (score >= 3) return 'Risk-on';
  if (score <= -3) return 'Risk-off';
  return 'Mixed';
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const quotePageUrl = (ticker: string): string =>
  `https://stooq.com/q/?s=${encodeURIComponent(ticker.toLowerCase())}`;

const parseTs = (date: string | undefined, time: string | undefined): number => {
  if (!date || date === 'N/D') return Date.now();
  const stamp = time && time !== 'N/D' ? `${date}T${time}Z` : `${date}T00:00:00Z`;
  const parsed = Date.parse(stamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
};
