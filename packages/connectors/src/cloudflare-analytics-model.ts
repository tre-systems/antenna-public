export type Sum = { readonly requests: number; readonly errors: number };
export type DailyRow = { readonly sum: Sum; readonly dimensions: { readonly date: string } };
export type WorkerRow = {
  readonly sum: Sum;
  readonly dimensions: { readonly scriptName: string; readonly status: string };
};
export type HourlyWorkerRow = {
  readonly sum: Sum;
  readonly dimensions: {
    readonly datetimeHour: string;
    readonly scriptName: string;
    readonly status: string;
  };
};
export type AccountRows = {
  readonly daily: readonly DailyRow[];
  readonly current: readonly WorkerRow[];
  readonly previous: readonly WorkerRow[];
  readonly hourly: readonly HourlyWorkerRow[];
};
export type Window = { readonly start: Date; readonly end: Date };
export type AnalyticsWindows = {
  readonly current: Window;
  readonly previous: Window;
  readonly trend: Window;
};

export const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Current and previous 24h windows are aligned to complete UTC hours, and the
// trend window to complete UTC days, so partial buckets never skew a comparison.
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
  const hourly = (account as { hourly?: unknown }).hourly;
  if (
    !Array.isArray(daily) ||
    !Array.isArray(current) ||
    !Array.isArray(previous) ||
    !Array.isArray(hourly)
  )
    return undefined;
  return {
    daily: daily.filter(isDailyRow),
    current: current.filter(isWorkerRow),
    previous: previous.filter(isWorkerRow),
    hourly: hourly.filter(isHourlyWorkerRow),
  };
};

const isSum = (value: unknown): value is Sum => {
  if (typeof value !== 'object' || value === null) return false;
  const sum = value as Record<string, unknown>;
  return typeof sum.requests === 'number' && typeof sum.errors === 'number';
};

const isDailyRow = (row: unknown): row is DailyRow => {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  const dims = r.dimensions as Record<string, unknown> | undefined;
  return isSum(r.sum) && typeof dims?.date === 'string';
};

const isWorkerRow = (row: unknown): row is WorkerRow => {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  const dims = r.dimensions as Record<string, unknown> | undefined;
  return isSum(r.sum) && typeof dims?.scriptName === 'string' && typeof dims.status === 'string';
};

const isHourlyWorkerRow = (row: unknown): row is HourlyWorkerRow => {
  if (!isWorkerRow(row)) return false;
  const dims = (row as { dimensions: Record<string, unknown> }).dimensions;
  return typeof dims.datetimeHour === 'string' && Number.isFinite(Date.parse(dims.datetimeHour));
};
