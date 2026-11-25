import type { ApiSignal, DataPoint } from '../api';

export const TODAY = Date.UTC(2026, 6, 11);

export const dayPoint = (day: string, requests: number): DataPoint => ({
  dimensions: { source: 'cloudflare-analytics', kind: 'day', day, metric: 'requests' },
  value: requests,
  unit: 'requests',
  ts: Date.parse(`${day}T00:00:00Z`),
});

// Dimensions round-trip through JSON as strings.
export const workerPoint = (script: string, requests: number, errors: number): DataPoint => ({
  dimensions: {
    source: 'cloudflare-analytics',
    kind: 'worker',
    window: 'current',
    script,
    errors: String(errors),
    error_rate_ppm: errors > 0 ? String(Math.round((errors / requests) * 1_000_000)) : '0',
    metric: 'requests',
  },
  value: requests,
  unit: 'requests',
  ts: TODAY,
});

export const comparisonPoint = (script: string, requests: number, errors: number): DataPoint => ({
  dimensions: {
    source: 'cloudflare-analytics',
    kind: 'worker-comparison',
    window: 'previous',
    script,
    errors: String(errors),
    error_rate_ppm: errors > 0 ? String(Math.round((errors / requests) * 1_000_000)) : '0',
    metric: 'requests',
  },
  value: requests,
  unit: 'requests',
  ts: TODAY,
});

export const statusPoint = (
  script: string,
  status: string,
  statusClass: string,
  requests: number,
  errors: number,
): DataPoint => ({
  dimensions: {
    source: 'cloudflare-analytics',
    kind: 'worker-status',
    window: 'current',
    script,
    status,
    status_class: statusClass,
    errors: String(errors),
    metric: 'requests',
  },
  value: requests,
  unit: 'requests',
  ts: TODAY,
});

export const scopedWindow = (window: 'current' | 'previous', value: number): DataPoint => ({
  dimensions: {
    source: 'cloudflare-analytics',
    kind: 'fleet-window',
    window,
    script: 'sample-worker',
    errors: '0',
    error_rate_ppm: '0',
  },
  value,
  unit: 'requests',
  ts: TODAY,
});

export const baseSignal: ApiSignal = {
  id: 'cf1',
  template_id: 'cloudflare-analytics',
  visibility: 'private',
  config: { account_id: 'a'.repeat(32), days: 7 },
  refresh_seconds: 3600,
  status: {
    status: 'live',
    last_ok_at: TODAY,
    last_attempt_at: TODAY,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [
    dayPoint('2026-07-09', 100),
    dayPoint('2026-07-10', 250),
    workerPoint('antenna', 300, 2),
    workerPoint('other-worker', 50, 0),
    comparisonPoint('antenna', 200, 1),
    statusPoint('antenna', 'clientDisconnected', 'disconnect', 8, 0),
    statusPoint('antenna', 'scriptThrewException', 'error', 2, 2),
    {
      dimensions: {
        source: 'cloudflare-analytics',
        kind: 'fleet-window',
        window: 'current',
        window_start: '2026-07-10T08:00:00.000Z',
        window_end: '2026-07-11T08:00:00.000Z',
        worker_count: '2',
        errors: '2',
        error_rate_ppm: '5714',
        metric: 'requests',
      },
      value: 350,
      unit: 'requests',
      ts: TODAY,
    },
    {
      dimensions: {
        source: 'cloudflare-analytics',
        kind: 'fleet-window',
        window: 'previous',
        window_start: '2026-07-09T08:00:00.000Z',
        window_end: '2026-07-10T08:00:00.000Z',
        errors: '1',
        error_rate_ppm: '4000',
        metric: 'requests',
      },
      value: 250,
      unit: 'requests',
      ts: TODAY,
    },
  ],
};
