import { fetchJson as fetchJsonShared } from './fetch-json';
import { discardResponse } from './discard-response';
import { htmlToText } from './html-text';
import type { AdapterError, AdapterResult, DataPoint } from './types';

type CommonContext = {
  readonly symbol: string;
  readonly label: string;
  readonly unit?: string;
  readonly sourceUrl?: string;
};

type FrankfurterResponse = {
  readonly rates?: Record<string, Record<string, number | string | null>>;
};

const DEFAULT_DAYS = 365;
const MAX_DAYS = 730;
const DAY_MS = 86_400_000;

export const parseBoeHtml = (html: string, context: CommonContext): DataPoint[] => {
  const points: DataPoint[] = [];
  const rowRx =
    /<td[^>]*>\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s*<\/td>\s*<td[^>]*>\s*([-+]?\d+(?:\.\d+)?)\s*<\/td>/g;
  for (const match of html.matchAll(rowRx)) {
    const [, rawDate, rawValue] = match;
    const ts = parseBoeDate(rawDate);
    const value = Number(rawValue);
    if (ts === null || !Number.isFinite(value)) continue;
    points.push(toPoint(context, value, ts));
  }
  return points;
};

export const parseBoeCsv = (csv: string, context: CommonContext): DataPoint[] => {
  const lines = csv
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const points: DataPoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, rawValue] = line.split(',');
    const value = numeric(rawValue);
    const ts = parseBoeDate(date);
    if (value === null || ts === null) continue;
    points.push(toPoint(context, value, ts));
  }
  return points;
};

export const parseEiaPetroleumDailyHtml = (html: string, context: CommonContext): DataPoint[] => {
  const points: DataPoint[] = [];
  const rowRx =
    /<tr>\s*<td[^>]*class=['"]B6['"][^>]*>(.*?)<\/td>\s*((?:<td[^>]*class=['"]B3['"][^>]*>.*?<\/td>\s*){5})<\/tr>/gis;
  for (const row of html.matchAll(rowRx)) {
    const [, rawLabel, rawCells] = row;
    const weekStart = parseEiaWeekStart(cleanHtml(rawLabel));
    if (weekStart === null || !rawCells) continue;

    const cells = [...rawCells.matchAll(/<td[^>]*class=['"]B3['"][^>]*>(.*?)<\/td>/gis)];
    cells.forEach((cell, index) => {
      const value = numeric(cleanHtml(cell[1]));
      if (value === null) return;
      points.push(toPoint(context, value, weekStart + index * DAY_MS));
    });
  }
  return points;
};

export const parseFrankfurter = (
  body: unknown,
  quote: string,
  context: CommonContext,
): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const rates = (body as FrankfurterResponse).rates;
  if (!rates || typeof rates !== 'object') return [];

  const points: DataPoint[] = [];
  for (const [date, row] of Object.entries(rates)) {
    const value = numeric(row[quote]);
    const ts = parseIsoDate(date);
    if (value === null || ts === null) continue;
    points.push(toPoint(context, value, ts));
  }
  return points;
};

export const parseFredCsv = (csv: string, context: CommonContext): DataPoint[] => {
  const lines = csv
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const points: DataPoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, rawValue] = line.split(',');
    const value = numeric(rawValue);
    const ts = parseIsoDate(date);
    if (value === null || ts === null) continue;
    points.push(toPoint(context, value, ts));
  }
  return points;
};

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

export const monthName = (date: Date): string => MONTHS[date.getUTCMonth()] ?? 'Jan';

export const boeDateParam = (date: Date): string =>
  `${String(date.getUTCDate()).padStart(2, '0')}/${monthName(date)}/${String(
    date.getUTCFullYear(),
  )}`;

const toPoint = (context: CommonContext, value: number, ts: number): DataPoint => ({
  dimensions: { symbol: context.symbol, label: context.label },
  value,
  unit: context.unit,
  ts,
  sourceUrl: context.sourceUrl,
});

const fetchFailed = (err: unknown): { ok: false; error: AdapterError } => ({
  ok: false,
  error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
});

const numeric = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampDays = (days: number): number => {
  if (!Number.isFinite(days)) return DEFAULT_DAYS;
  return Math.max(1, Math.min(Math.round(days), MAX_DAYS));
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const parseBoeDate = (value: string | undefined): number | null => {
  if (!value) return null;
  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, rawDay, rawMonth, rawYear] = match;
  if (!rawDay || !rawMonth || !rawYear) return null;
  const month = MONTHS.findIndex((m) => m.toLowerCase() === rawMonth.toLowerCase());
  if (month < 0) return null;
  const numericYear = Number(rawYear);
  const year = rawYear.length === 2 ? 2000 + numericYear : numericYear;
  const ts = Date.UTC(year, month, Number(rawDay));
  return Number.isFinite(ts) ? ts : null;
};

const parseEiaWeekStart = (value: string): number | null => {
  const match = /^(\d{4})\s+([A-Za-z]{3})-\s*(\d{1,2})\s+to\s+[A-Za-z]{3}-\s*\d{1,2}$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [, rawYear, rawMonth, rawDay] = match;
  if (!rawYear || !rawMonth || !rawDay) return null;
  const month = MONTHS.findIndex((m) => m.toLowerCase() === rawMonth.toLowerCase());
  if (month < 0) return null;
  const ts = Date.UTC(Number(rawYear), month, Number(rawDay));
  return Number.isFinite(ts) ? ts : null;
};

const parseIsoDate = (value: string | undefined): number | null => {
  if (!value) return null;
  const ts = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ts) ? ts : null;
};

const cleanHtml = (value: string | undefined): string => htmlToText(value ?? '');
