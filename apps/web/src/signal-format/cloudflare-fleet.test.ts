import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudflareFleetCardData } from './cloudflare-fleet';
import type { DataPoint } from '../api';
import {
  baseSignal,
  comparisonPoint,
  dayPoint,
  scopedWindow,
  TODAY,
  workerPoint,
} from './cloudflare-fleet-test-fixtures';

describe('cloudflareFleetCardData', () => {
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
        previousRequests: 200,
        previousErrors: 1,
        requestChangePercent: 50,
        statuses: [
          {
            status: 'scriptThrewException',
            statusClass: 'error',
            requests: 2,
            errors: 2,
          },
          {
            status: 'clientDisconnected',
            statusClass: 'disconnect',
            requests: 8,
            errors: 0,
          },
        ],
      },
      {
        script: 'other-worker',
        requests: 50,
        errors: 0,
        previousRequests: null,
        previousErrors: 0,
        requestChangePercent: null,
        statuses: [],
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

  it('ignores fleet points on a card scoped to one Worker', () => {
    const scopedDay: DataPoint = {
      ...dayPoint('2026-07-10', 80),
      dimensions: {
        ...dayPoint('2026-07-10', 80).dimensions,
        script: 'sample-worker',
      },
    };
    const data = cloudflareFleetCardData({
      ...baseSignal,
      config: { ...baseSignal.config, script: 'sample-worker' },
      points: [
        ...baseSignal.points,
        scopedDay,
        workerPoint('sample-worker', 75, 0),
        comparisonPoint('sample-worker', 50, 0),
        scopedWindow('current', 75),
        scopedWindow('previous', 50),
      ],
    });

    expect(data).toMatchObject({
      totalRequests: 80,
      workerCount: 1,
      workers: [
        {
          script: 'sample-worker',
          requests: 75,
          errors: 0,
          previousRequests: 50,
          previousErrors: 0,
          requestChangePercent: 50,
          statuses: [],
        },
      ],
      currentWindowRequests: 75,
      previousWindowRequests: 50,
      requestChangePercent: 50,
    });
  });
});
