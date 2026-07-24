import type { DataPoint } from '../api';
import { rankOf } from './common';
import type { RenderSignal } from './types';

export function displayPoints(signal: RenderSignal): DataPoint[] {
  const points = [...signal.points];
  if (signal.template_id === 'github-trending') {
    return points.sort((a, b) => rankOf(a) - rankOf(b));
  }
  if (signal.template_id === 'fx-pair') {
    const latest = mostRecent(points);
    return latest ? [latest] : [];
  }
  return points;
}

const tsOf = (p: DataPoint): number => {
  if (typeof p.observed_at === 'number') return p.observed_at;
  if (typeof p.fetched_at === 'number') return p.fetched_at;
  if (typeof p.ts === 'number') return p.ts;
  return Number.NEGATIVE_INFINITY;
};

const mostRecent = (points: ReadonlyArray<DataPoint>): DataPoint | null => {
  let best: DataPoint | null = null;
  let bestTs = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const t = tsOf(p);
    if (t === Number.NEGATIVE_INFINITY) continue;
    if (!best || t > bestTs) {
      best = p;
      bestTs = t;
    }
  }
  return best;
};
