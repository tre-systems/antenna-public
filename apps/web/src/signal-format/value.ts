import type { DataPoint } from '../api';

export function pointValueText(point: DataPoint): string {
  if (typeof point.value_text === 'string' && point.value_text.length > 0) {
    return point.value_text;
  }
  if (point.value === null) return '—';
  return formatValue(point.value);
}

export function formatValue(value: DataPoint['value']): string {
  if (value === null) return '—';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return value.toLocaleString('en-US');
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function compactNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}k`;
  return String(value);
}
