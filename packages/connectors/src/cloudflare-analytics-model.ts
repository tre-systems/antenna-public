import { isFiniteNumber } from './config-values';

export type Sum = { readonly requests: number; readonly errors: number };
export type DailyRow = {
  readonly sum: Sum;
  readonly dimensions: { readonly date: string; readonly scriptName?: string };
};
export type WorkerRow = {
  readonly sum: Sum;
  readonly dimensions: { readonly scriptName: string; readonly status: string };
};
export type AccountRows = {
  readonly daily: readonly DailyRow[];
  readonly current: readonly WorkerRow[];
  readonly previous: readonly WorkerRow[];
};
export type Window = { readonly start: Date; readonly end: Date };
export type AnalyticsWindows = {
  readonly current: Window;
  readonly previous: Window;
  readonly trend: Window;
};

export const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Complete UTC buckets keep partial periods from skewing comparisons.
export const analyticsWindows = (now: Date, days: number): AnalyticsWindows => {
  const end = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const currentStart = new Date(end.getTime() - DAY_MS);
  const previousStart = new Date(currentStart.getTime() - DAY_MS);
  const trendEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  return {
    current: { start: currentStart, end },
    previous: { start: previousStart, end: currentStart },
    trend: { start: new Date(trendEnd.getTime() - days * DAY_MS), end: trendEnd },
  };
};

export const serialiseWindows = (windows: AnalyticsWindows) => ({
  current: serialiseWindow(windows.current),
  previous: serialiseWindow(windows.previous),
  trend: serialiseWindow(windows.trend),
});

const serialiseWindow = (window: Window) => ({
  start: window.start.toISOString(),
  end: window.end.toISOString(),
});

export const firstGraphqlError = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) return null;
  const errors = (payload as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first: unknown = errors[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    typeof (first as { message?: unknown }).message === 'string'
  ) {
    return (first as { message: string }).message;
  }
  return 'GraphQL query failed';
};

export const readAccount = (payload: unknown): AccountRows | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const accounts = (payload as { data?: { viewer?: { accounts?: unknown } } }).data?.viewer
    ?.accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) return undefined;
  const account: unknown = accounts[0];
  if (typeof account !== 'object' || account === null) return undefined;
  const daily = (account as { daily?: unknown }).daily;
  const current = (account as { current?: unknown }).current;
  const previous = (account as { previous?: unknown }).previous;
  if (!Array.isArray(daily) || !Array.isArray(current) || !Array.isArray(previous))
    return undefined;
  return {
    daily: daily.filter(isDailyRow),
    current: current.filter(isWorkerRow),
    previous: previous.filter(isWorkerRow),
  };
};

const isSum = (value: unknown): value is Sum => {
  if (typeof value !== 'object' || value === null) return false;
  const sum = value as Record<string, unknown>;
  return isFiniteNumber(sum.requests) && isFiniteNumber(sum.errors);
};

const isDailyRow = (row: unknown): row is DailyRow => {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  const dims = r.dimensions as Record<string, unknown> | undefined;
  return (
    isSum(r.sum) &&
    typeof dims?.date === 'string' &&
    (dims.scriptName === undefined || typeof dims.scriptName === 'string')
  );
};

const isWorkerRow = (row: unknown): row is WorkerRow => {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  const dims = r.dimensions as Record<string, unknown> | undefined;
  return isSum(r.sum) && typeof dims?.scriptName === 'string' && typeof dims.status === 'string';
};
