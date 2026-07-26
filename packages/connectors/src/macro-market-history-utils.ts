import { fetchJson as fetchJsonShared } from './fetch-json';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import { monthName } from './macro-market-history-parsers';
import type { AdapterError, AdapterResult, DataPoint } from './types';

const DEFAULT_DAYS = 365;
const MAX_DAYS = 730;
const DAY_MS = 86_400_000;

export const pointsResult = (points: DataPoint[], rawPayload: unknown): AdapterResult => {
  if (points.length === 0) return parseFailed('no macro history points parsed');
  return { ok: true, points, rawPayload };
};

export const fetchText = async (
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: true; body: string } | { ok: false; error: AdapterError }> => {
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    return fetchFailed(err);
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }
  try {
    return { ok: true, body: await response.text() };
  } catch (err) {
    return fetchFailed(err);
  }
};

export const fetchJson = (
  url: string,
): Promise<{ ok: true; body: unknown } | { ok: false; error: AdapterError }> =>
  fetchJsonShared(url, { headers: { accept: 'application/json' } });

export const parseFailed = (message: string): AdapterResult => ({
  ok: false,
  error: { code: 'parse_failed', message },
});

export const dateRange = (days: number | undefined): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date(end.getTime() - clampDays(days ?? DEFAULT_DAYS) * DAY_MS);
  return { start, end };
};

export const isoDateRange = (days: number | undefined): { startIso: string; endIso: string } => {
  const { start, end } = dateRange(days);
  return { startIso: toIsoDate(start), endIso: toIsoDate(end) };
};

// The BoE database expects DD/Mon/YYYY, not an ISO date.
export const boeDateParam = (date: Date): string =>
  `${String(date.getUTCDate()).padStart(2, '0')}/${monthName(date)}/${String(
    date.getUTCFullYear(),
  )}`;

const fetchFailed = (err: unknown): { ok: false; error: AdapterError } => ({
  ok: false,
  error: { code: 'fetch_failed', message: errorMessage(err) },
});

const clampDays = (days: number): number => {
  if (!Number.isFinite(days)) return DEFAULT_DAYS;
  return Math.max(1, Math.min(Math.round(days), MAX_DAYS));
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);
