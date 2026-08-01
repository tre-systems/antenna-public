import type { DataPoint } from '../api';
import type { RenderSignal } from './types';

export const safeExternalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? trimmed : null;
  } catch {
    return null;
  }
};

export function signalTitle(signal: RenderSignal): string {
  return signal.display?.title || signal.title || signal.template_id;
}

export function signalSourceLabel(signal: RenderSignal): string {
  return signal.display?.source_label || signal.template_id;
}

export function signalSourceUrl(signal: RenderSignal): string | null {
  const supplied = safeExternalUrl(signal.display?.source_url);
  if (supplied) return supplied;
  return firstSafePointUrl(signal.points);
}

export function pointSourceUrl(point: DataPoint, _signal: RenderSignal): string | null {
  return safeExternalUrl(point.display?.source_url) ?? safeExternalUrl(point.source_url);
}

const firstSafePointUrl = (points: ReadonlyArray<DataPoint>): string | null => {
  for (const point of points) {
    const url = safeExternalUrl(point.display?.source_url) ?? safeExternalUrl(point.source_url);
    if (url) return url;
  }
  return null;
};
