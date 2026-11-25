import type { ApiSignal, PublicApiSignal } from './api';

type Signal = ApiSignal | PublicApiSignal;

export function isManualSnapshot(signal: Signal): boolean {
  return (
    signal.template_id === 'manual-cost' ||
    signal.template_id === 'manual-metric' ||
    signal.points.some((point) => point.dimensions?.posture === 'manual')
  );
}

export function snapshotTime(signal: Signal): string {
  const point = signal.points.find((candidate) => candidate.dimensions?.metric === 'cost');
  const asOf = point?.dimensions?.as_of ?? ('config' in signal ? signal.config.asOf : undefined);
  return snapshotDate(asOf);
}

export function snapshotDate(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Date unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function snapshotLabel(date: string): string {
  return date === 'Date unknown' ? 'Snapshot date unknown' : `As of ${date}`;
}
