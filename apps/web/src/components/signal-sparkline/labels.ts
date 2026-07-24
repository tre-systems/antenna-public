import type { ChangeStyle, SeriesPoint } from './types';

const DAY_MS = 86_400_000;

export const formatHoverDate = (ts: number): string => {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const percentChange = (points: readonly SeriesPoint[]): number | null => {
  if (points.length < 2) return null;
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (first === undefined || last === undefined || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
};

export const spanLabelFor = (points: readonly SeriesPoint[]): string => {
  if (points.length < 2) return 'Recent';
  const days = spanDays(points);
  if (days >= 300) return '1Y';
  if (days >= 80) return '3m';
  if (days >= 25) return '30d';
  if (days >= 6) return '7d';
  if (days >= 1) return `${String(Math.round(days))}d`;
  return 'Today';
};

export const changeColour = (change: number | null): ChangeStyle | null => {
  if (change === null) return null;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) {
    return { colour: 'text-slate-500 dark:text-slate-400', label: '0.0%' };
  }
  if (rounded > 0) return positiveChange(rounded);
  return { colour: 'text-rose-600 dark:text-rose-300', label: `${rounded.toFixed(1)}%` };
};

const positiveChange = (rounded: number): ChangeStyle => ({
  colour: 'text-emerald-600 dark:text-emerald-300',
  label: `+${rounded.toFixed(1)}%`,
});

const spanDays = (points: readonly SeriesPoint[]): number => {
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.ts < minTs) minTs = point.ts;
    if (point.ts > maxTs) maxTs = point.ts;
  }
  return (maxTs - minTs) / DAY_MS;
};
