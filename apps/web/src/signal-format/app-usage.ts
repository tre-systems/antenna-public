import type { RenderSignal } from './types';
import { numericValue, recentDays, resolveWindowDays, stringDim } from './daily-window';

// Turns the app-usage signal's per-(day, event) points into a daily trend:
// a zero-filled series over the configured window, the window total, and the
// top events by volume. The connector only returns days that had events, so
// the zero-fill here is what makes the bar chart show the whole window
// (including quiet days) rather than a lone spike.

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
// The connector emits this synthetic event (count 0) when a project has no
// activity, purely to keep the signal `live`. It must not appear as a real
// event or inflate any total.
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

    // Gate everything on the day being inside the window so the window total,
    // the bar series, and the top-event counts always reconcile.
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
