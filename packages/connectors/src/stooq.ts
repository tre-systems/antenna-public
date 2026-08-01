import { browserRequestInit } from './browser-request';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { AdapterResult } from './types';

export const STOOQ_CSV_REQUEST_INIT = browserRequestInit('text/csv,*/*;q=0.8');

type CsvFetchResult =
  { readonly ok: true; readonly body: string } | Extract<AdapterResult, { ok: false }>;

export const fetchStooqCsv = async (ticker: string): Promise<CsvFetchResult> => {
  const primary = await fetchStooqHost('stooq.com', ticker);
  if (primary.ok) return primary;

  const fallback = await fetchStooqHost('stooq.pl', ticker);
  if (fallback.ok) return fallback;

  return {
    ok: false,
    error: {
      code: 'fetch_failed',
      message: `stooq.com: ${primary.error.message}; stooq.pl: ${fallback.error.message}`,
    },
  };
};

export const stooqCsvUrl = (host: 'stooq.com' | 'stooq.pl', ticker: string): string =>
  `https://${host}/q/l/?s=${encodeURIComponent(ticker)}&f=sd2t2ohlcv&h&e=csv`;

const fetchStooqHost = async (
  host: 'stooq.com' | 'stooq.pl',
  ticker: string,
): Promise<CsvFetchResult> => {
  const url = stooqCsvUrl(host, ticker);
  let response: Response;
  try {
    response = await fetch(url, STOOQ_CSV_REQUEST_INIT);
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: errorMessage(err) },
    };
  }

  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  try {
    const body = await response.text();
    if (!looksLikeStooqCsv(body)) {
      return {
        ok: false,
        error: { code: 'fetch_failed', message: 'invalid CSV response' },
      };
    }
    return { ok: true, body };
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: errorMessage(err) },
    };
  }
};

const looksLikeStooqCsv = (body: string): boolean => {
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine?.startsWith('Symbol,') ?? false;
};
