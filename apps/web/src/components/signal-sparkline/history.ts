import type { HistoryPoint } from '../../api';
import { pointLabel } from '../../signal-format';
import type { SeriesPoint, SeriesWithLabel } from './types';

type GroupedPoint = {
  readonly key: string;
  readonly label: string;
  readonly point: SeriesPoint;
};

type SeriesOptions = {
  readonly groupByLabel?: boolean;
  readonly preferredLabel?: string | null;
};

export const bestSeries = (
  points: readonly HistoryPoint[],
  options: SeriesOptions = {},
): SeriesWithLabel => {
  const grouped = new Map<string, SeriesWithLabel>();
  for (const point of points) {
    const groupedPoint = toGroupedPoint(point, options.groupByLabel === true);
    if (groupedPoint !== null) appendGroupedPoint(grouped, groupedPoint);
  }

  const series = [...grouped.values()];
  const preferred = options.preferredLabel?.toLocaleLowerCase('en-GB');
  return (
    series.find((candidate) => candidate.label.toLocaleLowerCase('en-GB') === preferred) ??
    series.reduce(longestSeries, emptySeries())
  );
};

export const pointTimestamp = (point: HistoryPoint): number =>
  typeof point.observed_at === 'number' ? point.observed_at : point.fetched_at;

const appendGroupedPoint = (grouped: Map<string, SeriesWithLabel>, groupedPoint: GroupedPoint) => {
  const existing = grouped.get(groupedPoint.key) ?? { label: groupedPoint.label, points: [] };
  existing.points.push(groupedPoint.point);
  grouped.set(groupedPoint.key, existing);
};

const toGroupedPoint = (point: HistoryPoint, groupByLabel: boolean): GroupedPoint | null => {
  if (typeof point.value !== 'number' || !Number.isFinite(point.value)) return null;
  const ts = pointTimestamp(point);
  if (!Number.isFinite(ts)) return null;
  const label = pointLabel(point);
  return {
    key: groupByLabel ? label.toLocaleLowerCase('en-GB') : point.metric_key,
    label,
    point: { ts, value: point.value },
  };
};

const emptySeries = (): SeriesWithLabel => ({ label: 'Value', points: [] });

const longestSeries = (best: SeriesWithLabel, candidate: SeriesWithLabel): SeriesWithLabel =>
  candidate.points.length > best.points.length ? candidate : best;
