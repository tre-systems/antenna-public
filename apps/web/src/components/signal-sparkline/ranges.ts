import type { SeriesPoint } from './types';

export type SparklineRange = '1w' | '1m' | '1y';

export type SparklineRangeOption = {
  readonly value: SparklineRange;
  readonly label: string;
  readonly days: number;
};

export const SPARKLINE_RANGES: readonly SparklineRangeOption[] = [
  { value: '1w', label: '1W', days: 7 },
  { value: '1m', label: '1M', days: 30 },
  { value: '1y', label: '1Y', days: 365 },
];

export const DEFAULT_SPARKLINE_RANGE: SparklineRange = '1y';

const DAY_MS = 86_400_000;

export const sparklineRangeLabel = (range: SparklineRange): string =>
  SPARKLINE_RANGES.find((option) => option.value === range)?.label ?? '1Y';

export const filterSeriesForRange = (
  points: readonly SeriesPoint[],
  range: SparklineRange,
): SeriesPoint[] => {
  const option = SPARKLINE_RANGES.find((candidate) => candidate.value === range);
  if (!option || points.length < 2) return [...points];
  const latest = points[points.length - 1]?.ts;
  if (latest === undefined || !Number.isFinite(latest)) return [...points];

  const filtered = points.filter((point) => point.ts >= latest - option.days * DAY_MS);
  return filtered.length >= 2 ? filtered : points.slice(-2);
};
