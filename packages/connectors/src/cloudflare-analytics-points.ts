import { type DailyRow, type Sum, type Window, type WorkerRow } from './cloudflare-analytics-model';
import type { DataPoint } from './types';

type WindowName = 'current' | 'previous';
type StatusClass = 'disconnect' | 'error' | 'other';

const SOURCE = 'cloudflare-analytics';
const STATUS_RESERVE = 5;

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

export const workerDetailPoints = (
  currentRows: readonly WorkerRow[],
  previousRows: readonly WorkerRow[],
  currentWindow: Window,
  previousWindow: Window,
  pointLimit: number,
): DataPoint[] => {
  const current = aggregateWorkers(currentRows);
  const previous = aggregateWorkers(previousRows);
  const statuses = workerStatusPoints(currentRows, currentWindow);
  const reservedStatuses = Math.min(statuses.length, STATUS_RESERVE, pointLimit);
  const workerLimit = Math.max(0, Math.floor((pointLimit - reservedStatuses) / 2));
  const scripts = rankedScripts(current, previous).slice(0, workerLimit);
  const workers = scripts.flatMap((script) => [
    workerPoint(script, current.get(script) ?? emptySum(), 'current', currentWindow, 'worker'),
    workerPoint(
      script,
      previous.get(script) ?? emptySum(),
      'previous',
      previousWindow,
      'worker-comparison',
    ),
  ]);
  return [...workers, ...statuses.slice(0, Math.max(0, pointLimit - workers.length))];
};

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
      worker_count: aggregateWorkers(rows).size,
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

const workerPoint = (
  script: string,
  sum: Sum,
  windowName: WindowName,
  window: Window,
  kind: 'worker' | 'worker-comparison',
): DataPoint => ({
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
});

const workerStatusPoints = (rows: readonly WorkerRow[], window: Window): DataPoint[] =>
  [...aggregateStatuses(rows).values()].sort(statusOrder).map(({ script, status, sum }) => ({
    dimensions: {
      source: SOURCE,
      kind: 'worker-status',
      ...windowDimensions('current', window),
      script,
      status,
      status_class: statusClass(status, sum),
      ...errorDimensions(sum),
      metric: 'requests',
    },
    value: count(sum.requests),
    unit: 'requests',
    ts: window.end.getTime(),
  }));

type StatusAggregate = { readonly script: string; readonly status: string; readonly sum: Sum };

const aggregateStatuses = (rows: readonly WorkerRow[]): Map<string, StatusAggregate> => {
  const statuses = new Map<string, StatusAggregate>();
  for (const row of rows) {
    if (row.dimensions.status === 'success') continue;
    const { scriptName: script, status } = row.dimensions;
    const key = `${script}\0${status}`;
    const sum = statuses.get(key)?.sum ?? emptySum();
    statuses.set(key, { script, status, sum: addSums(sum, row.sum) });
  }
  return statuses;
};

const statusOrder = (a: StatusAggregate, b: StatusAggregate): number =>
  b.sum.errors - a.sum.errors ||
  b.sum.requests - a.sum.requests ||
  a.script.localeCompare(b.script) ||
  a.status.localeCompare(b.status);

const statusClass = (status: string, sum: Sum): StatusClass => {
  if (status === 'clientDisconnected') return 'disconnect';
  return sum.errors > 0 ? 'error' : 'other';
};

const aggregateWorkers = (rows: readonly WorkerRow[]): Map<string, Sum> => {
  const workers = new Map<string, Sum>();
  for (const row of rows) {
    const previous = workers.get(row.dimensions.scriptName) ?? { requests: 0, errors: 0 };
    workers.set(row.dimensions.scriptName, addSums(previous, row.sum));
  }
  return workers;
};

const rankedScripts = (current: Map<string, Sum>, previous: Map<string, Sum>): string[] =>
  [...new Set([...current.keys(), ...previous.keys()])].sort((a, b) => {
    const aRequests = Math.max(current.get(a)?.requests ?? 0, previous.get(a)?.requests ?? 0);
    const bRequests = Math.max(current.get(b)?.requests ?? 0, previous.get(b)?.requests ?? 0);
    return bRequests - aRequests || a.localeCompare(b);
  });

const emptySum = (): Sum => ({ requests: 0, errors: 0 });

const addSums = (a: Sum, b: Sum): Sum => ({
  requests: a.requests + b.requests,
  errors: a.errors + b.errors,
});

const sumRows = (rows: readonly WorkerRow[]): Sum =>
  rows.reduce(
    (sum, row) => ({
      requests: sum.requests + row.sum.requests,
      errors: sum.errors + row.sum.errors,
    }),
    { requests: 0, errors: 0 },
  );
