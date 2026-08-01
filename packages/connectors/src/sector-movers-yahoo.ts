import { errorMessage } from './error-message';
import type { Adapter, AdapterError, AdapterResult, DataPoint } from './types';
import { YAHOO_CHART_REQUEST_INIT, yahooChartUrl, yahooQuotePageUrl } from './yahoo-quote';
import { discardResponse } from './discard-response';

type SectorEtf = { readonly ticker: string; readonly sector: string };

// SPDR sector ETFs proxy GICS sectors without maintaining constituent lists.
const SECTORS: ReadonlyArray<SectorEtf> = [
  { ticker: 'XLK', sector: 'Technology' },
  { ticker: 'XLC', sector: 'Communication Services' },
  { ticker: 'XLY', sector: 'Consumer Discretionary' },
  { ticker: 'XLP', sector: 'Consumer Staples' },
  { ticker: 'XLE', sector: 'Energy' },
  { ticker: 'XLF', sector: 'Financials' },
  { ticker: 'XLV', sector: 'Health Care' },
  { ticker: 'XLI', sector: 'Industrials' },
  { ticker: 'XLB', sector: 'Materials' },
  { ticker: 'XLRE', sector: 'Real Estate' },
  { ticker: 'XLU', sector: 'Utilities' },
];

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        chartPreviousClose?: number;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        currency?: string;
      };
    }>;
    error?: { description?: string } | null;
  };
};

type SectorQuote = {
  readonly ticker: string;
  readonly sector: string;
  readonly previousClose: number;
  readonly currentPrice: number;
  readonly ts: number;
  readonly currency: string;
};

type SectorFetchResult =
  | { readonly ok: true; readonly quote: SectorQuote }
  | { readonly ok: false; readonly error: AdapterError };

export const sectorMoversYahoo: Adapter = async (): Promise<AdapterResult> => {
  const results = await Promise.all(SECTORS.map(fetchSector));
  for (const r of results) {
    if (!r.ok) return { ok: false, error: r.error };
  }
  const quotes = results
    .map((r) => (r.ok ? r.quote : null))
    .filter((q): q is SectorQuote => q !== null);

  // Descending, so the compact-rows projection renders winners before losers.
  const ranked = quotes
    .map((q) => ({ quote: q, change: percentChange(q) }))
    .sort((a, b) => b.change - a.change);

  const points: DataPoint[] = ranked.map(({ quote, change }, idx) => ({
    dimensions: {
      metric: 'sector_change',
      ticker: quote.ticker,
      sector: quote.sector,
      current_price: quote.currentPrice,
      currency: quote.currency,
      rank: idx + 1,
    },
    value: round2(change),
    unit: '%',
    ts: quote.ts,
    sourceUrl: yahooQuotePageUrl(quote.ticker),
  }));

  return { ok: true, points, rawPayload: ranked };
};

const percentChange = (q: SectorQuote): number =>
  ((q.currentPrice - q.previousClose) / q.previousClose) * 100;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const fetchSector = async (etf: SectorEtf): Promise<SectorFetchResult> => {
  let response: Response;
  try {
    response = await fetch(yahooChartUrl(etf.ticker), YAHOO_CHART_REQUEST_INIT);
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: `${etf.ticker}: ${errorMessage(err)}` },
    };
  }

  if (!response.ok) {
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'fetch_failed', message: `${etf.ticker}: HTTP ${String(response.status)}` },
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: `${etf.ticker}: ${errorMessage(err)}` },
    };
  }

  const meta = (body as YahooChartResponse).chart?.result?.[0]?.meta;
  const previousClose = meta?.chartPreviousClose;
  const currentPrice = meta?.regularMarketPrice;
  if (typeof previousClose !== 'number' || !Number.isFinite(previousClose) || previousClose === 0) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: `${etf.ticker}: missing chartPreviousClose` },
    };
  }
  if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: `${etf.ticker}: missing regularMarketPrice` },
    };
  }

  const ts =
    typeof meta?.regularMarketTime === 'number' && Number.isFinite(meta.regularMarketTime)
      ? meta.regularMarketTime * 1000
      : Date.now();

  return {
    ok: true,
    quote: {
      ticker: etf.ticker,
      sector: etf.sector,
      previousClose,
      currentPrice,
      ts,
      currency: meta?.currency ?? 'USD',
    },
  };
};
