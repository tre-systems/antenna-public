import type { CompactRow } from './compact-row-types';

export const formatDaysUntil = (days: number): string => {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${String(days)}d`;
  if (days < 60) return `in ${String(Math.round(days / 7))}w`;
  return `in ${String(Math.round(days / 30))}mo`;
};

export const formatDateAdded = (iso: string): string => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const days = Math.round((Date.now() - ms) / 86_400_000);
  if (days < 0) return iso;
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${String(days)}d ago`;
  if (days < 60) return `${String(Math.round(days / 7))}w ago`;
  return iso;
};

export const severityTone = (sev: string | null): CompactRow['chipTone'] => {
  if (sev === 'critical') return 'urgent';
  if (sev === 'high') return 'warn';
  return 'muted';
};

export const countdownTone = (days: number): CompactRow['chipTone'] => {
  if (!Number.isFinite(days)) return 'muted';
  if (days <= 1) return 'urgent';
  if (days < 7) return 'warn';
  if (days <= 14) return 'info';
  return 'ok';
};

export const cloudflareStatusTone = (status: string | null): CompactRow['chipTone'] => {
  if (status === 'investigating' || status === 'identified') return 'urgent';
  if (status === 'monitoring') return 'warn';
  if (status === 'resolved') return 'ok';
  return 'muted';
};

export const stripSeverityPrefix = (text: string): string =>
  text.replace(/^(?:CRITICAL|HIGH|MODERATE|LOW)\s*·\s*/i, '');

export const formatJobsCount = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
};

export const formatSignedPercent = (n: number): string => {
  const fixed = Math.abs(n).toFixed(2);
  if (n > 0) return `+${fixed}%`;
  if (n < 0) return `-${fixed}%`;
  return `${fixed}%`;
};
