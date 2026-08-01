import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appUsageCardData } from './app-usage';
import type { ApiSignal, DataPoint } from '../api';

describe('appUsageCardData', () => {
  // Fixed "today" so the zero-filled day window is deterministic.
  const TODAY = Date.UTC(2026, 6, 11); // 2026-07-11 UTC

  const usagePoint = (day: string, event: string, value: number): DataPoint => ({
    dimensions: { source: 'app-usage', project: 'sample-app', event, day },
    value,
    unit: 'events',
    ts: Date.parse(`${day}T00:00:00Z`),
  });

  const baseSignal: ApiSignal = {
    id: 'u1',
    template_id: 'app-usage',
    visibility: 'private',
    config: { project: 'sample-app', account_id: 'a'.repeat(32) },
    refresh_seconds: 3600,
    status: {
      status: 'live',
      last_ok_at: TODAY,
      last_attempt_at: TODAY,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [
      usagePoint('2026-07-11', 'character_generated', 5),
      usagePoint('2026-07-11', 'character_saved', 2),
      usagePoint('2026-07-10', 'character_generated', 3),
      usagePoint('2026-07-05', 'portrait_generated', 1),
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for non-app-usage signals and before any points arrive', () => {
    expect(appUsageCardData({ ...baseSignal, template_id: 'fx-pair' })).toBeNull();
    expect(appUsageCardData({ ...baseSignal, points: [] })).toBeNull();
  });

  it('builds a zero-filled daily series with the window total and top events', () => {
    const data = appUsageCardData(baseSignal);
    expect(data).not.toBeNull();
    if (!data) return;

    expect(data.windowDays).toBe(14);
    expect(data.days).toHaveLength(14);
    expect(data.days[0]).toBe('2026-06-28');
    expect(data.days[13]).toBe('2026-07-11');
    expect(data.series).toHaveLength(14);
    // 2026-07-05 → 1, 2026-07-10 → 3, 2026-07-11 → 7, everything else 0.
    expect(data.series[7]).toBe(1); // 2026-07-05
    expect(data.series[12]).toBe(3); // 2026-07-10
    expect(data.series[13]).toBe(7); // 2026-07-11
    expect(data.series.reduce((a, b) => a + b, 0)).toBe(11);
    expect(data.totalEvents).toBe(11);
    expect(data.todayCount).toBe(7);
    expect(data.peakCount).toBe(7);
    expect(data.topEvents).toEqual([
      { event: 'character_generated', count: 8 },
      { event: 'character_saved', count: 2 },
      { event: 'portrait_generated', count: 1 },
    ]);
  });

  it('ignores the synthetic zero-activity event and non-positive counts', () => {
    const data = appUsageCardData({
      ...baseSignal,
      points: [
        {
          dimensions: { source: 'app-usage', project: 'x', event: 'total', day: '2026-07-11' },
          value: 0,
          ts: TODAY,
        },
        usagePoint('2026-07-11', 'noise', 0),
      ],
    });
    expect(data?.totalEvents).toBe(0);
    expect(data?.topEvents).toEqual([]);
    expect(data?.series.every((n) => n === 0)).toBe(true);
  });

  it('drops points that fall outside the configured window so totals reconcile', () => {
    const data = appUsageCardData({
      ...baseSignal,
      config: { ...baseSignal.config, days: 7 },
      points: [
        usagePoint('2026-07-11', 'character_saved', 4),
        usagePoint('2026-06-01', 'character_saved', 99), // outside the 7-day window
      ],
    });
    expect(data?.windowDays).toBe(7);
    expect(data?.days).toHaveLength(7);
    expect(data?.totalEvents).toBe(4);
    expect(data?.topEvents).toEqual([{ event: 'character_saved', count: 4 }]);
  });
});
