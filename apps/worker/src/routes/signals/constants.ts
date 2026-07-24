export const POINT_LIMIT = 50;
export const HISTORY_POINT_LIMIT = 5_000;
export const MIN_REFRESH_SECONDS = 60;
export const MAX_REFRESH_SECONDS = 7 * 86_400;
export const MANUAL_REFRESH_RATE_LIMIT_MS = 60_000;

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_MS = 366 * DAY_MS;

export type TimedHistoryRange = '1m' | '3m' | '6m' | '1y';
export type HistoryRange = TimedHistoryRange | 'all';

const RANGE_MS: Readonly<Partial<Record<string, number>>> = {
  '1m': 31 * DAY_MS,
  '3m': 93 * DAY_MS,
  '6m': 186 * DAY_MS,
  '1y': DEFAULT_RANGE_MS,
};

export const rangeToMs = (range: TimedHistoryRange): number => RANGE_MS[range] ?? DEFAULT_RANGE_MS;
