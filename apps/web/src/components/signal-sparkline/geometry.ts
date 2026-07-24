import {
  SPARKLINE_HEIGHT,
  SPARKLINE_PAD,
  SPARKLINE_WIDTH,
  type SeriesBounds,
  type SeriesPoint,
} from './types';

export const sortSeries = (points: readonly SeriesPoint[]): SeriesPoint[] =>
  [...points].sort((a, b) => a.ts - b.ts);

export const seriesBounds = (points: readonly SeriesPoint[]): SeriesBounds => {
  const minTs = points[0]?.ts ?? 0;
  const maxTs = points[points.length - 1]?.ts ?? minTs;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return {
    minTs,
    maxTs,
    minValue,
    maxValue,
    spanTs: Math.max(1, maxTs - minTs),
    spanValue: Math.max(1e-9, maxValue - minValue),
  };
};

export const projectX = (ts: number, bounds: SeriesBounds): number =>
  SPARKLINE_PAD + ((ts - bounds.minTs) / bounds.spanTs) * (SPARKLINE_WIDTH - SPARKLINE_PAD * 2);

export const projectY = (value: number, bounds: SeriesBounds): number =>
  SPARKLINE_HEIGHT -
  SPARKLINE_PAD -
  ((value - bounds.minValue) / bounds.spanValue) * (SPARKLINE_HEIGHT - SPARKLINE_PAD * 2);

export const sparklinePath = (points: readonly SeriesPoint[]): string => {
  if (points.length === 0) return '';
  const sorted = sortSeries(points);
  const bounds = seriesBounds(sorted);
  return sorted.map((point, index) => pathSegment(point, index, bounds)).join(' ');
};

export const nearestPointIndex = (
  points: readonly SeriesPoint[],
  targetX: number,
  bounds: SeriesBounds,
): number => {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    const dist = Math.abs(projectX(point.ts, bounds) - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
};

export const tooltipLeftForX = (x: number): string => `${String((x / SPARKLINE_WIDTH) * 100)}%`;

const pathSegment = (point: SeriesPoint, index: number, bounds: SeriesBounds): string => {
  const x = projectX(point.ts, bounds);
  const y = projectY(point.value, bounds);
  return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
};
