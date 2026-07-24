import type { DataPoint } from '../api';
import type { RenderSignal } from './types';

export const configOf = (signal: RenderSignal): Readonly<Record<string, unknown>> =>
  'config' in signal ? signal.config : {};

export const rankOf = (point: DataPoint): number => {
  const rank = point.dimensions?.rank;
  if (typeof rank === 'number') return rank;
  if (typeof rank === 'string') {
    const n = Number(rank);
    if (Number.isFinite(n)) return n;
  }
  return Number.POSITIVE_INFINITY;
};

export const numOf = (raw: unknown): number => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return Number.POSITIVE_INFINITY;
};

export const strOf = (raw: unknown): string | null => {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
};

export const fixed1 = (n: number): string => n.toFixed(1);

export const capitalize = (s: string): string =>
  s.length === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
