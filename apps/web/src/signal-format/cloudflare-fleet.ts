import type { RenderSignal } from './types';
import { numericDim, numericValue, recentDays, resolveWindowDays, stringDim } from './daily-window';

// The connector pre-aggregates into `kind:'day'` and `kind:'worker'` points to fit the point cap.

export type FleetWorker = {
  readonly script: string;
  readonly requests: number;
  readonly errors: number;
  readonly previousRequests: number | null;
  readonly previousErrors: number;
  readonly requestChangePercent: number | null;
  readonly statuses: ReadonlyArray<FleetWorkerStatus>;
};

export type FleetWorkerStatus = {
  readonly status: string;
  readonly statusClass: string;
  readonly requests: number;
  readonly errors: number;
};

export type CloudflareFleetCardData = {
  readonly windowDays: number;
  readonly totalRequests: number;
  readonly totalErrors: number;
  readonly workerCount: number;
  readonly days: ReadonlyArray<string>;
  readonly series: ReadonlyArray<number>;
  readonly peakCount: number;
  readonly workers: ReadonlyArray<FleetWorker>;
  readonly currentWindowRequests: number;
  readonly previousWindowRequests: number | null;
  readonly currentWindowErrors: number;
  readonly currentErrorRatePpm: number;
  readonly requestChangePercent: number | null;
};

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 30;
const TOP_WORKER_LIMIT = 10;

export function cloudflareFleetCardData(signal: RenderSignal): CloudflareFleetCardData | null {
  if (signal.template_id !== 'cloudflare-analytics') return null;
  if (signal.points.length === 0) return null;

  const windowDays = resolveWindowDays(signal, DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS);
  // Cloudflare returns complete UTC days through yesterday, so discard today.
  const days = recentDays(windowDays + 1).slice(0, -1);
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const series = new Array<number>(days.length).fill(0);
  const workerSnapshots = new Map<string, { requests: number; errors: number }>();
  const workerComparisons = new Map<string, { requests: number; errors: number }>();
  const workerStatuses = new Map<string, FleetWorkerStatus[]>();
  let currentWindowRequests: number | null = null;
  let previousWindowRequests: number | null = null;
  let currentWindowErrors = 0;
  let currentErrorRatePpm = 0;
  let currentWorkerCount: number | null = null;
  const configuredScript = scriptFromConfig(signal);

  for (const point of signal.points) {
    const kind = stringDim(point, 'kind');
    if (configuredScript !== null && scopedKind(kind)) {
      if (stringDim(point, 'script') !== configuredScript) continue;
    }
    if (kind === 'day') {
      const day = stringDim(point, 'day');
      const index = day === null ? undefined : dayIndex.get(day);
      if (index !== undefined) series[index] = (series[index] ?? 0) + numericValue(point);
    } else if (kind === 'worker') {
      const script = stringDim(point, 'script');
      if (script === null) continue;
      workerSnapshots.set(script, {
        requests: numericValue(point),
        errors: numericDim(point, 'errors'),
      });
    } else if (kind === 'worker-comparison') {
      const script = stringDim(point, 'script');
      if (script === null) continue;
      workerComparisons.set(script, {
        requests: numericValue(point),
        errors: numericDim(point, 'errors'),
      });
    } else if (kind === 'worker-status') {
      appendWorkerStatus(workerStatuses, point);
    } else if (kind === 'fleet-window') {
      const windowName = stringDim(point, 'window');
      if (windowName === 'current') {
        currentWindowRequests = numericValue(point);
        currentWindowErrors = numericDim(point, 'errors');
        currentErrorRatePpm = numericDim(point, 'error_rate_ppm');
        currentWorkerCount =
          point.dimensions?.worker_count === undefined ? null : numericDim(point, 'worker_count');
      } else if (windowName === 'previous') {
        previousWindowRequests = numericValue(point);
      }
    }
  }

  const workers: FleetWorker[] = [...workerSnapshots.entries()].map(([script, snapshot]) => {
    const comparison = workerComparisons.get(script);
    return {
      script,
      ...snapshot,
      previousRequests: comparison?.requests ?? null,
      previousErrors: comparison?.errors ?? 0,
      requestChangePercent: percentChange(snapshot.requests, comparison?.requests ?? null),
      statuses: [...(workerStatuses.get(script) ?? [])].sort(statusOrder),
    };
  });
  const dailyTotal = series.reduce((sum, count) => sum + count, 0);
  const workerTotal = workers.reduce((sum, worker) => sum + worker.requests, 0);
  const workerErrors = workers.reduce((sum, worker) => sum + worker.errors, 0);
  const topWorkers = [...workers]
    .sort(
      (a, b) => b.errors - a.errors || b.requests - a.requests || a.script.localeCompare(b.script),
    )
    .slice(0, TOP_WORKER_LIMIT);

  return {
    windowDays,
    // Worker totals keep incomplete snapshots useful when daily rows are absent.
    totalRequests: dailyTotal > 0 ? dailyTotal : workerTotal,
    totalErrors: currentWindowRequests === null ? workerErrors : currentWindowErrors,
    workerCount: currentWorkerCount ?? workers.length,
    days,
    series,
    peakCount: series.reduce((max, count) => Math.max(max, count), 0),
    workers: topWorkers,
    currentWindowRequests: currentWindowRequests ?? workerTotal,
    previousWindowRequests,
    currentWindowErrors,
    currentErrorRatePpm,
    requestChangePercent: percentChange(
      currentWindowRequests ?? workerTotal,
      previousWindowRequests,
    ),
  };
}

const scriptFromConfig = (signal: RenderSignal): string | null => {
  if (!('config' in signal)) return null;
  const script = signal.config.script;
  return typeof script === 'string' && script.trim() ? script.trim() : null;
};

const scopedKind = (kind: string | null): boolean =>
  kind === 'day' ||
  kind === 'worker' ||
  kind === 'worker-comparison' ||
  kind === 'worker-status' ||
  kind === 'fleet-window';

const appendWorkerStatus = (
  statuses: Map<string, FleetWorkerStatus[]>,
  point: RenderSignal['points'][number],
): void => {
  const script = stringDim(point, 'script');
  const status = stringDim(point, 'status');
  const statusClass = stringDim(point, 'status_class');
  if (script === null || status === null || statusClass === null) return;
  const rows = statuses.get(script) ?? [];
  rows.push({
    status,
    statusClass,
    requests: numericValue(point),
    errors: numericDim(point, 'errors'),
  });
  statuses.set(script, rows);
};

const statusOrder = (a: FleetWorkerStatus, b: FleetWorkerStatus): number =>
  b.errors - a.errors || b.requests - a.requests || a.status.localeCompare(b.status);

const percentChange = (current: number, previous: number | null): number | null => {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};
