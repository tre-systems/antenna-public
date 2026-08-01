import { browserRequestInit } from './browser-request';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { AdapterError } from './types';

export type YahooLatestQuote = {
  readonly requestedSymbol: string;
  readonly symbol: string;
  readonly price: number;
  readonly previousClose: number;
  readonly changePct: number;
  readonly ts: number;
  readonly currency: string | undefined;
  readonly sourceUrl: string;
};

type YahooQuoteResult =
  | { readonly ok: true; readonly quote: YahooLatestQuote; readonly rawPayload: unknown }
  | { readonly ok: false; readonly error: AdapterError };

type YahooChartResponse = {
  readonly chart?: {
    readonly result?: YahooResult[];
    readonly error?: { readonly description?: string } | null;
  };
};

type YahooResult = {
  readonly meta?: {
    readonly symbol?: string;
    readonly currency?: string;
    readonly chartPreviousClose?: number;
    readonly regularMarketPrice?: number;
    readonly regularMarketTime?: number;
  };
  readonly timestamp?: number[];
  readonly indicators?: {
    readonly quote?: Array<{ readonly close?: Array<number | null> }>;
  };
};

type ClosePoint = {
  readonly close: number;
  readonly ts: number;
};

export const YAHOO_CHART_REQUEST_INIT = browserRequestInit('application/json');

export const fetchYahooLatestQuote = async (symbol: string): Promise<YahooQuoteResult> => {
  const requestedSymbol = symbol.trim();
  if (requestedSymbol.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'symbol is required' } };
  }

  const url = yahooChartUrl(requestedSymbol);
  let response: Response;
  try {
    response = await fetch(url, YAHOO_CHART_REQUEST_INIT);
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }

  const quote = parseYahooLatestQuote(body, requestedSymbol);
  if (!quote) {
    const description = yahooErrorDescription(body);
    return {
      ok: false,
      error: { code: 'parse_failed', message: description ?? 'no quote parsed' },
    };
  }
  return { ok: true, quote, rawPayload: body };
};

export const yahooChartUrl = (symbol: string): string =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

export const yahooQuotePageUrl = (symbol: string): string =>
  `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`;

export const yahooSymbolForStooqTicker = (ticker: string): string => {
  const upper = ticker.trim().toUpperCase();
  if (upper.endsWith('.US')) return upper.slice(0, -3);
  if (upper.endsWith('.UK')) return `${upper.slice(0, -3)}.L`;
  return upper;
};

const parseYahooLatestQuote = (body: unknown, requestedSymbol: string): YahooLatestQuote | null => {
  if (!body || typeof body !== 'object') return null;
  const result = (body as YahooChartResponse).chart?.result?.[0];
  if (!result) return null;

  const symbol = result.meta?.symbol ?? requestedSymbol;
  const metaPrice = finiteNumber(result.meta?.regularMarketPrice);
  const metaPrevious = finiteNumber(result.meta?.chartPreviousClose);
  const metaTs = finiteNumber(result.meta?.regularMarketTime);
  if (validMarketPrice(metaPrice) && validMarketPrice(metaPrevious)) {
    return {
      requestedSymbol,
      symbol,
      price: metaPrice,
      previousClose: metaPrevious,
      changePct: percentChange(metaPrice, metaPrevious),
      ts: metaTs === null ? Date.now() : metaTs * 1000,
      currency: result.meta?.currency,
      sourceUrl: yahooQuotePageUrl(symbol),
    };
  }

  const closes = closePoints(result);
  const latest = closes.at(-1);
  const previous = closes.at(-2);
  if (!latest || !previous || !validMarketPrice(previous.close)) return null;

  return {
    requestedSymbol,
    symbol,
    price: latest.close,
    previousClose: previous.close,
    changePct: percentChange(latest.close, previous.close),
    ts: latest.ts,
    currency: result.meta?.currency,
    sourceUrl: yahooQuotePageUrl(symbol),
  };
};

const closePoints = (result: YahooResult): ClosePoint[] => {
  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  const points: ClosePoint[] = [];
  timestamps.forEach((timestamp, index) => {
    const close = closes[index];
    if (!validMarketPrice(close)) return;
    points.push({ close, ts: timestamp * 1000 });
  });
  return points;
};

const yahooErrorDescription = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  return (body as YahooChartResponse).chart?.error?.description ?? null;
};

const percentChange = (price: number, previous: number): number =>
  ((price - previous) / previous) * 100;

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const validMarketPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
