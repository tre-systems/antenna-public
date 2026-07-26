import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudflareFleetCardData } from './cloudflare-fleet';
import type { ApiSignal, DataPoint } from '../api';

describe('cloudflareFleetCardData', () => {
  const TODAY = Date.UTC(2026, 6, 11); // 2026-07-11 UTC

  const dayPoint = (day: string, requests: number): DataPoint => ({
    dimensions: { source: 'cloudflare-analytics', kind: 'day', day, metric: 'requests' },
    value: requests,
    unit: 'requests',
    ts: Date.parse(`${day}T00:00:00Z`),
  });
  // Dimensions round-trip through JSON as strings, so errors arrives as a string.
  const workerPoint = (script: string, requests: number, errors: number): DataPoint => ({
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

  const baseSignal: ApiSignal = {
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
      workerPoint('cepheus', 50, 0),
      {
        dimensions: {
          source: 'cloudflare-analytics',
          kind: 'worker-comparison',
          window: 'previous',
          script: 'antenna',
          errors: '1',
          error_rate_ppm: '5000',
          metric: 'requests',
        },
        value: 200,
        unit: 'requests',
        ts: TODAY,
      },
      {
        dimensions: {
          source: 'cloudflare-analytics',
          kind: 'fleet-window',
          window: 'current',
          window_start: '2026-07-10T08:00:00.000Z',
          window_end: '2026-07-11T08:00:00.000Z',
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for non-fleet signals and before any points arrive', () => {
    expect(cloudflareFleetCardData({ ...baseSignal, template_id: 'app-usage' })).toBeNull();
    expect(cloudflareFleetCardData({ ...baseSignal, points: [] })).toBeNull();
  });

  it('builds the daily request trend plus the per-worker breakdown', () => {
    const data = cloudflareFleetCardData(baseSignal);
    expect(data).not.toBeNull();
    if (!data) return;

    expect(data.windowDays).toBe(7);
    expect(data.days).toHaveLength(7);
    expect(data.series[5]).toBe(100); // 2026-07-09
    expect(data.series[6]).toBe(250); // 2026-07-10
    expect(data.totalRequests).toBe(350);
    expect(data.peakCount).toBe(250);
    expect(data.workerCount).toBe(2);
    expect(data.totalErrors).toBe(2);
    expect(data.workers).toEqual([
      {
        script: 'antenna',
        requests: 300,
        errors: 2,
      },
      {
        script: 'cepheus',
        requests: 50,
        errors: 0,
      },
    ]);
    expect(data.currentWindowRequests).toBe(350);
    expect(data.previousWindowRequests).toBe(250);
    expect(data.currentWindowErrors).toBe(2);
    expect(data.currentErrorRatePpm).toBe(5714);
    expect(data.requestChangePercent).toBe(40);
  });

  it('keeps a quiet account live with a zero total', () => {
    const data = cloudflareFleetCardData({
      ...baseSignal,
      points: [dayPoint('2026-07-10', 0)],
    });
    expect(data?.totalRequests).toBe(0);
    expect(data?.workers).toEqual([]);
    expect(data?.currentWindowRequests).toBe(0);
    expect(data?.previousWindowRequests).toBeNull();
  });
});
