import type { RenderSignal } from './types';
import { numericValue, recentDays, resolveWindowDays, stringDim } from './daily-window';

// The connector only returns days that had events, so the zero-fill is what shows quiet days.

export type AppUsageEventTotal = {
  readonly event: string;
  readonly count: number;
};

export type AppUsageCardData = {
  readonly windowDays: number;
  readonly totalEvents: number;
  readonly todayCount: number;
  readonly peakCount: number;
  readonly days: ReadonlyArray<string>;
  readonly series: ReadonlyArray<number>;
  readonly topEvents: ReadonlyArray<AppUsageEventTotal>;
};

const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 90;
const TOP_EVENT_LIMIT = 4;
// A zero-count synthetic total keeps quiet projects live but is not usage.
const SYNTHETIC_EVENT = 'total';

export function appUsageCardData(signal: RenderSignal): AppUsageCardData | null {
  if (signal.template_id !== 'app-usage') return null;
  if (signal.points.length === 0) return null;

  const windowDays = resolveWindowDays(signal, DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS);
  const days = recentDays(windowDays);
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const series = new Array<number>(days.length).fill(0);
  const eventTotals = new Map<string, number>();

  for (const point of signal.points) {
    const event = stringDim(point, 'event');
    if (event === null || event === SYNTHETIC_EVENT) continue;
    const count = numericValue(point);
    if (count <= 0) continue;

    // Applying one window gate keeps totals, bars, and event counts consistent.
    const day = stringDim(point, 'day');
    if (day === null) continue;
    const index = dayIndex.get(day);
    if (index === undefined) continue;

    series[index] = (series[index] ?? 0) + count;
    eventTotals.set(event, (eventTotals.get(event) ?? 0) + count);
  }

  const totalEvents = series.reduce((sum, count) => sum + count, 0);
  const peakCount = series.reduce((max, count) => Math.max(max, count), 0);
  const topEvents = [...eventTotals.entries()]
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count || a.event.localeCompare(b.event))
    .slice(0, TOP_EVENT_LIMIT);

  return {
    windowDays,
    totalEvents,
    todayCount: series[series.length - 1] ?? 0,
    peakCount,
    days,
    series,
    topEvents,
  };
}
