import { decodeHtmlEntitiesOnce, stripHtmlTags } from './html-text';
import type { DataPoint } from './types';

export type MacroSeriesContext = {
  readonly symbol: string;
  readonly label: string;
  readonly unit?: string;
  readonly sourceUrl?: string;
};

type FrankfurterResponse = {
  readonly rates?: Record<string, Record<string, number | string | null>>;
};

const DAY_MS = 86_400_000;

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

export const monthName = (date: Date): string => MONTHS[date.getUTCMonth()] ?? 'Jan';

export const parseBoeCsv = (csv: string, context: MacroSeriesContext): DataPoint[] =>
  parseTwoColumnCsv(csv, context, parseBoeDate);

export const parseFredCsv = (csv: string, context: MacroSeriesContext): DataPoint[] =>
  parseTwoColumnCsv(csv, context, parseIsoDate);

export const parseEiaPetroleumDailyHtml = (
  html: string,
  context: MacroSeriesContext,
): DataPoint[] => {
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
  context: MacroSeriesContext,
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

type DateParser = (value: string | undefined) => number | null;

const parseTwoColumnCsv = (
  csv: string,
  context: MacroSeriesContext,
  parseDate: DateParser,
): DataPoint[] => {
  const lines = csv
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const points: DataPoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, rawValue] = line.split(',');
    const value = numeric(rawValue);
    const ts = parseDate(date);
    if (value === null || ts === null) continue;
    points.push(toPoint(context, value, ts));
  }
  return points;
};

const toPoint = (context: MacroSeriesContext, value: number, ts: number): DataPoint => ({
  dimensions: { symbol: context.symbol, label: context.label },
  value,
  unit: context.unit,
  ts,
  sourceUrl: context.sourceUrl,
});

const numeric = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoeDate: DateParser = (value) => {
  if (!value) return null;
  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, rawDay, rawMonth, rawYear] = match;
  if (!rawDay || !rawMonth || !rawYear) return null;
  const month = monthIndex(rawMonth);
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
  const month = monthIndex(rawMonth);
  if (month < 0) return null;
  const ts = Date.UTC(Number(rawYear), month, Number(rawDay));
  return Number.isFinite(ts) ? ts : null;
};

const parseIsoDate: DateParser = (value) => {
  if (!value) return null;
  const ts = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ts) ? ts : null;
};

const monthIndex = (name: string): number =>
  MONTHS.findIndex((month) => month.toLowerCase() === name.toLowerCase());

// EIA splices markup inside tokens, so tags must be removed without separators.
const cleanHtml = (value: string | undefined): string =>
  decodeHtmlEntitiesOnce(stripHtmlTags(value ?? '', ''))
    .replace(/\s+/g, ' ')
    .trim();
