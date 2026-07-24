import type { AdapterResult } from './types';

export const STOOQ_CSV_REQUEST_INIT = {
  headers: {
    accept: 'text/csv,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  },
} satisfies RequestInit;

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
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (!response.ok) {
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
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
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
