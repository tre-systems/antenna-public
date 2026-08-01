import type { DataPoint } from '../api';
import type { RenderSignal } from './types';

const DAY_MS = 86_400_000;

export function resolveWindowDays(signal: RenderSignal, fallback: number, max: number): number {
  const config = 'config' in signal ? signal.config : undefined;
  const raw = config?.days;
  const parsed = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

// UTC dates match connector day grouping.
export function recentDays(windowDays: number): string[] {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: string[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    out.push(new Date(todayUtc - offset * DAY_MS).toISOString().slice(0, 10));
  }
  return out;
}

export function stringDim(point: DataPoint, key: string): string | null {
  const value = point.dimensions?.[key];
  return typeof value === 'string' ? value : null;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function numericValue(point: DataPoint): number {
  return toFiniteNumber(point.value);
}

export function numericDim(point: DataPoint, key: string): number {
  return toFiniteNumber(point.dimensions?.[key]);
}
