import type { RenderSignal } from './types';
import { numericDim, numericValue, recentDays, resolveWindowDays, stringDim } from './daily-window';

// The connector pre-aggregates into `kind:'day'` and `kind:'worker'` points to fit the point cap.

export type FleetWorker = {
  readonly script: string;
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
const TOP_WORKER_LIMIT = 6;

export function cloudflareFleetCardData(signal: RenderSignal): CloudflareFleetCardData | null {
  if (signal.template_id !== 'cloudflare-analytics') return null;
  if (signal.points.length === 0) return null;

  const windowDays = resolveWindowDays(signal, DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS);
  // Cloudflare's trend rows are complete UTC days ending yesterday. Ask the
  // shared helper for one extra day, then remove today.
  const days = recentDays(windowDays + 1).slice(0, -1);
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const series = new Array<number>(days.length).fill(0);
  const workerSnapshots = new Map<string, { requests: number; errors: number }>();
  let currentWindowRequests: number | null = null;
  let previousWindowRequests: number | null = null;
  let currentWindowErrors = 0;
  let currentErrorRatePpm = 0;

  for (const point of signal.points) {
    const kind = stringDim(point, 'kind');
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
    } else if (kind === 'fleet-window') {
      const windowName = stringDim(point, 'window');
      if (windowName === 'current') {
        currentWindowRequests = numericValue(point);
        currentWindowErrors = numericDim(point, 'errors');
        currentErrorRatePpm = numericDim(point, 'error_rate_ppm');
      } else if (windowName === 'previous') {
        previousWindowRequests = numericValue(point);
      }
    }
  }

  const workers: FleetWorker[] = [...workerSnapshots.entries()].map(([script, snapshot]) => ({
    script,
    ...snapshot,
  }));
  const dailyTotal = series.reduce((sum, count) => sum + count, 0);
  const workerTotal = workers.reduce((sum, worker) => sum + worker.requests, 0);
  const topWorkers = [...workers]
    .sort((a, b) => b.requests - a.requests || a.script.localeCompare(b.script))
    .slice(0, TOP_WORKER_LIMIT);

  return {
    windowDays,
    // Prefer the summed daily series; fall back to the worker totals if a
    // snapshot somehow lacks the day rows.
    totalRequests: dailyTotal > 0 ? dailyTotal : workerTotal,
    totalErrors: workers.reduce((sum, worker) => sum + worker.errors, 0),
    workerCount: workers.length,
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

const percentChange = (current: number, previous: number | null): number | null => {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};
