import type { HistoryPoint } from '../../api';
import { pointLabel } from '../../signalFormat';
import type { SeriesPoint, SeriesWithLabel } from './types';

type GroupedPoint = {
  readonly key: string;
  readonly label: string;
  readonly point: SeriesPoint;
};

export const bestSeries = (points: readonly HistoryPoint[]): SeriesWithLabel => {
  const grouped = new Map<string, SeriesWithLabel>();
  for (const point of points) {
    const groupedPoint = toGroupedPoint(point);
    if (groupedPoint !== null) appendGroupedPoint(grouped, groupedPoint);
  }

  return [...grouped.values()].reduce(longestSeries, emptySeries());
};

export const pointTimestamp = (point: HistoryPoint): number =>
  typeof point.observed_at === 'number' ? point.observed_at : point.fetched_at;

const appendGroupedPoint = (grouped: Map<string, SeriesWithLabel>, groupedPoint: GroupedPoint) => {
  const existing = grouped.get(groupedPoint.key) ?? { label: groupedPoint.label, points: [] };
  existing.points.push(groupedPoint.point);
  grouped.set(groupedPoint.key, existing);
};

const toGroupedPoint = (point: HistoryPoint): GroupedPoint | null => {
  if (typeof point.value !== 'number' || !Number.isFinite(point.value)) return null;
  const ts = pointTimestamp(point);
  if (!Number.isFinite(ts)) return null;
  return {
    key: point.metric_key,
    label: pointLabel(point),
    point: { ts, value: point.value },
  };
};

const emptySeries = (): SeriesWithLabel => ({ label: 'Value', points: [] });

const longestSeries = (best: SeriesWithLabel, candidate: SeriesWithLabel): SeriesWithLabel =>
  candidate.points.length > best.points.length ? candidate : best;
