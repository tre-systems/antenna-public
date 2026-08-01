import { type DailyRow, type Sum, type Window, type WorkerRow } from './cloudflare-analytics-model';
import type { DataPoint } from './types';

type WindowName = 'current' | 'previous';

const SOURCE = 'cloudflare-analytics';

export const dailyPoint = (row: DailyRow): DataPoint => {
  const day = row.dimensions.date.slice(0, 10);
  return {
    dimensions: {
      source: SOURCE,
      kind: 'day',
      day,
      ...(row.dimensions.scriptName ? { script: row.dimensions.scriptName } : {}),
      metric: 'requests',
    },
    value: count(row.sum.requests),
    unit: 'requests',
    ts: Date.parse(`${day}T00:00:00Z`),
  };
};

export const workerPoints = (
  rows: readonly WorkerRow[],
  windowName: WindowName,
  window: Window,
  kind: 'worker' | 'worker-comparison',
): DataPoint[] =>
  [...aggregateWorkers(rows).entries()].map(([script, sum]) => ({
    dimensions: {
      source: SOURCE,
      kind,
      ...windowDimensions(windowName, window),
      script,
      ...errorDimensions(sum),
      metric: 'requests',
    },
    value: count(sum.requests),
    unit: 'requests',
    ts: window.end.getTime(),
  }));

export const windowPoint = (
  rows: readonly WorkerRow[],
  windowName: WindowName,
  window: Window,
  script?: string,
): DataPoint => {
  const sum = sumRows(rows);
  return {
    dimensions: {
      source: SOURCE,
      kind: 'fleet-window',
      ...windowDimensions(windowName, window),
      ...(script ? { script } : {}),
      ...errorDimensions(sum),
      metric: 'requests',
    },
    value: count(sum.requests),
    unit: 'requests',
    ts: window.end.getTime(),
  };
};

const windowDimensions = (windowName: WindowName, window: Window) => ({
  window: windowName,
  window_start: window.start.toISOString(),
  window_end: window.end.toISOString(),
});

const errorDimensions = (sum: Sum) => {
  const requests = count(sum.requests);
  const errors = count(sum.errors);
  return {
    errors,
    error_rate_ppm: requests > 0 ? Math.round((errors / requests) * 1_000_000) : 0,
  };
};

const count = (value: number): number => Math.max(0, Math.round(value));

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
