import type { Adapter, AdapterResult, DataPoint } from './types';

// Reads Cloudflare's built-in Workers analytics (GraphQL Analytics API,
// workersInvocationsAdaptive) so every deployed Worker shows up without any
// instrumentation. The query returns a complete-day trend plus aligned complete
// UTC-hour current/previous 24-hour windows, including invocation status.
//
// All user-influenced inputs are passed as GraphQL variables, so there is no
// query-string interpolation and no injection surface.

type CloudflareAnalyticsConfig = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly days?: number;
};

type Sum = { readonly requests: number; readonly errors: number };
type DailyRow = { readonly sum: Sum; readonly dimensions: { readonly date: string } };
type WorkerRow = {
  readonly sum: Sum;
  readonly dimensions: { readonly scriptName: string; readonly status: string };
};
type HourlyWorkerRow = {
  readonly sum: Sum;
  readonly dimensions: {
    readonly datetimeHour: string;
    readonly scriptName: string;
    readonly status: string;
  };
};
type AccountRows = {
  readonly daily: readonly DailyRow[];
  readonly current: readonly WorkerRow[];
  readonly previous: readonly WorkerRow[];
  readonly hourly: readonly HourlyWorkerRow[];
};
type Window = { readonly start: Date; readonly end: Date };
type AnalyticsWindows = {
  readonly current: Window;
  readonly previous: Window;
  readonly trend: Window;
};

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const ACCOUNT_ID_RX = /^[0-9a-f]{32}$/;
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const QUERY = `query FleetAnalytics(
  $account: String!
  $trendStart: Time!
  $trendEnd: Time!
  $previousStart: Time!
  $currentStart: Time!
  $end: Time!
) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      daily: workersInvocationsAdaptive(
        limit: 1000
        filter: { datetime_geq: $trendStart, datetime_lt: $trendEnd }
        orderBy: [date_ASC]
      ) {
        sum { requests errors }
        dimensions { date }
      }
      current: workersInvocationsAdaptive(
        limit: 1000
        filter: { datetime_geq: $currentStart, datetime_lt: $end }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests errors }
        dimensions { scriptName status }
      }
      previous: workersInvocationsAdaptive(
        limit: 1000
        filter: { datetime_geq: $previousStart, datetime_lt: $currentStart }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests errors }
        dimensions { scriptName status }
      }
      hourly: workersInvocationsAdaptive(
        limit: 10000
        filter: { datetime_geq: $currentStart, datetime_lt: $end }
        orderBy: [datetimeHour_ASC]
      ) {
        sum { requests errors }
        dimensions { datetimeHour scriptName status }
      }
    }
  }
}`;

export const cloudflareAnalytics: Adapter<CloudflareAnalyticsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const accountId = config.accountId.trim();
  const apiToken = config.apiToken.trim();
  const days = normaliseDays(config.days);

  if (!ACCOUNT_ID_RX.test(accountId)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid account id' } };
  }
  if (apiToken.length === 0) {
    return { ok: false, error: { code: 'unauthorized', message: 'missing analytics API token' } };
  }

  const windows = analyticsWindows(new Date(), days);
  const body = JSON.stringify({
    query: QUERY,
    variables: {
      account: accountId,
      trendStart: windows.trend.start.toISOString(),
      trendEnd: windows.trend.end.toISOString(),
      previousStart: windows.previous.start.toISOString(),
      currentStart: windows.current.start.toISOString(),
      end: windows.current.end.toISOString(),
    },
  });

  let response: Response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: { code: 'unauthorized', message: `Cloudflare GraphQL HTTP ${response.status}` },
    };
  }
  if (response.status === 429) {
    return { ok: false, error: { code: 'rate_limited', message: 'Cloudflare GraphQL rate limit' } };
  }
  if (!response.ok) {
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  // GraphQL returns HTTP 200 with an `errors` array on query/permission
  // failures — surface those as unauthorized/parse rather than silent success.
  const graphqlError = firstGraphqlError(payload);
  if (graphqlError !== null) {
    const unauthorized = /auth|permission|denied|forbidden/i.test(graphqlError);
    return {
      ok: false,
      error: { code: unauthorized ? 'unauthorized' : 'parse_failed', message: graphqlError },
    };
  }

  const account = readAccount(payload);
  if (account === undefined) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected GraphQL payload' } };
  }

  const points: DataPoint[] = [
    ...account.daily.map(dailyPoint),
    ...workerPoints(account.current, 'current', windows.current, 'worker'),
    ...workerPoints(account.previous, 'previous', windows.previous, 'worker-comparison'),
    ...statusPoints(account.current, 'current', windows.current),
    ...statusPoints(account.previous, 'previous', windows.previous),
    ...hourlyExceptionPoints(account.hourly),
    windowPoint(account.current, 'current', windows.current),
    windowPoint(account.previous, 'previous', windows.previous),
  ];

  return {
    ok: true,
    points,
    rawPayload: {
      days,
      windows: serialiseWindows(windows),
      daily: account.daily,
      current: account.current,
      previous: account.previous,
      hourly: account.hourly,
    },
  };
};

const dailyPoint = (row: DailyRow): DataPoint => {
  const day = row.dimensions.date.slice(0, 10);
  return {
    dimensions: { source: 'cloudflare-analytics', kind: 'day', day, metric: 'requests' },
    value: Math.max(0, Math.round(row.sum.requests)),
    unit: 'requests',
    ts: Date.parse(`${day}T00:00:00Z`),
  };
};

const workerPoints = (
  rows: readonly WorkerRow[],
  windowName: 'current' | 'previous',
  window: Window,
  kind: 'worker' | 'worker-comparison',
): DataPoint[] =>
  [...aggregateWorkers(rows).entries()].map(([script, sum]) => {
    const requests = Math.max(0, Math.round(sum.requests));
    const errors = Math.max(0, Math.round(sum.errors));
    return {
      dimensions: {
        source: 'cloudflare-analytics',
        kind,
        window: windowName,
        window_start: window.start.toISOString(),
        window_end: window.end.toISOString(),
        script,
        errors,
        error_rate_ppm: requests > 0 ? Math.round((errors / requests) * 1_000_000) : 0,
        metric: 'requests',
      },
      value: requests,
      unit: 'requests',
      ts: window.end.getTime(),
    };
  });

const statusPoints = (
  rows: readonly WorkerRow[],
  windowName: 'current' | 'previous',
  window: Window,
): DataPoint[] =>
  rows.map((row) => ({
    dimensions: {
      source: 'cloudflare-analytics',
      kind: 'worker-status',
      window: windowName,
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
      script: row.dimensions.scriptName,
      status: row.dimensions.status,
      errors: Math.max(0, Math.round(row.sum.errors)),
      metric: 'requests',
    },
    value: Math.max(0, Math.round(row.sum.requests)),
    unit: 'requests',
    ts: window.end.getTime(),
  }));

// Hourly points are limited to exception outcomes so a health review can place
// Worker failures in time without multiplying the routine success/disconnect
// telemetry. `clientDisconnected` remains a non-exception outcome.
const hourlyExceptionPoints = (rows: readonly HourlyWorkerRow[]): DataPoint[] =>
  rows.filter(isExceptionOutcome).map((row) => {
    const hourStart = new Date(row.dimensions.datetimeHour);
    const hourEnd = new Date(hourStart.getTime() + HOUR_MS);
    return {
      dimensions: {
        source: 'cloudflare-analytics',
        kind: 'worker-status-hour',
        hour_start: hourStart.toISOString(),
        hour_end: hourEnd.toISOString(),
        script: row.dimensions.scriptName,
        status: row.dimensions.status,
        errors: Math.max(0, Math.round(row.sum.errors)),
        metric: 'requests',
      },
      value: Math.max(0, Math.round(row.sum.requests)),
      unit: 'requests',
      ts: hourEnd.getTime(),
    };
  });

const isExceptionOutcome = (row: HourlyWorkerRow): boolean =>
  row.dimensions.status !== 'success' && row.dimensions.status !== 'clientDisconnected';

const windowPoint = (
  rows: readonly WorkerRow[],
  windowName: 'current' | 'previous',
  window: Window,
): DataPoint => {
  const sum = sumRows(rows);
  const requests = Math.max(0, Math.round(sum.requests));
  const errors = Math.max(0, Math.round(sum.errors));
  return {
    dimensions: {
      source: 'cloudflare-analytics',
      kind: 'fleet-window',
      window: windowName,
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
      errors,
      error_rate_ppm: requests > 0 ? Math.round((errors / requests) * 1_000_000) : 0,
      metric: 'requests',
    },
    value: requests,
    unit: 'requests',
    ts: window.end.getTime(),
  };
};

const aggregateWorkers = (rows: readonly WorkerRow[]): Map<string, Sum> => {
  const workers = new Map<string, Sum>();
  for (const row of rows) {
    const previous = workers.get(row.dimensions.scriptName) ?? { requests: 0, errors: 0 };
    workers.set(row.dimensions.scriptName, {
      requests: previous.requests + row.sum.requests,
      errors: previous.errors + row.sum.errors,
    });
  }
  return workers;
};

const sumRows = (rows: readonly WorkerRow[]): Sum =>
  rows.reduce(
    (sum, row) => ({
      requests: sum.requests + row.sum.requests,
      errors: sum.errors + row.sum.errors,
    }),
    { requests: 0, errors: 0 },
  );

const normaliseDays = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(1, Math.trunc(value)));
};

const analyticsWindows = (now: Date, days: number): AnalyticsWindows => {
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

const serialiseWindows = (windows: AnalyticsWindows) => ({
  current: {
    start: windows.current.start.toISOString(),
    end: windows.current.end.toISOString(),
  },
  previous: {
    start: windows.previous.start.toISOString(),
    end: windows.previous.end.toISOString(),
  },
  trend: {
    start: windows.trend.start.toISOString(),
    end: windows.trend.end.toISOString(),
  },
});

const firstGraphqlError = (payload: unknown): string | null => {
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

const readAccount = (payload: unknown): AccountRows | undefined => {
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
