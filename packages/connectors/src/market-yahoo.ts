import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult, DataPoint } from './types';
import { YAHOO_CHART_REQUEST_INIT, yahooQuotePageUrl } from './yahoo-quote';

export type YahooMarketHistoryConfig = {
  readonly symbol: string;
  readonly range?: '1mo' | '3mo' | '6mo' | '1y';
};

type YahooChartResponse = {
  chart?: {
    result?: YahooResult[];
    error?: { description?: string } | null;
  };
};

type YahooResult = {
  meta?: {
    symbol?: string;
    currency?: string;
    shortName?: string;
    longName?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ close?: Array<number | null> }>;
  };
};

export const yahooMarketHistory: Adapter<YahooMarketHistoryConfig> = async (
  config,
): Promise<AdapterResult> => {
  const symbol = config.symbol.trim();
  if (symbol.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'symbol is required' } };
  }

  const range = config.range ?? '1y';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const fetched = await fetchJson(url, YAHOO_CHART_REQUEST_INIT);
  if (!fetched.ok) return fetched;

  const points = parseYahooChart(fetched.body, symbol, yahooQuotePageUrl(symbol));
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no close prices parsed' } };
  }
  return { ok: true, points, rawPayload: fetched.body };
};

const parseYahooChart = (
  body: unknown,
  requestedSymbol: string,
  sourceUrl: string,
): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const chart = (body as YahooChartResponse).chart;
  const result = chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  const symbol = result.meta?.symbol ?? requestedSymbol;
  const unit = result.meta?.currency;
  const points: DataPoint[] = [];

  timestamps.forEach((timestamp, index) => {
    const close = closes[index];
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return;
    points.push({
      dimensions: { ticker: symbol.toUpperCase() },
      value: close,
      unit,
      ts: timestamp * 1000,
      sourceUrl,
    });
  });

  return points;
};
