import type { DataPoint } from '../api';
import { numOf, strOf } from './common';
import type { CompactRow } from './compact-row-types';

export const portfolioRow = (point: DataPoint, rank: number): CompactRow | null => {
  const project = strOf(point.dimensions?.project);
  const events = Number(point.value);
  if (!project || !Number.isFinite(events)) return null;
  const comparison = activityComparison(
    events,
    numOf(point.dimensions?.previous),
    numOf(point.dimensions?.change),
    strOf(point.dimensions?.telemetry_state),
    strOf(point.dimensions?.last_event_at),
    'activity',
  );
  const topEvent = strOf(point.dimensions?.top_event);
  return {
    rank,
    title: projectLabel(project),
    subtitle: topEvent ? `${comparison} · ${topEvent.replaceAll('_', ' ')}` : comparison,
    chip: `${Math.round(events).toLocaleString('en-GB')} events`,
    chipTone: events > 0 ? 'ok' : 'muted',
    href: null,
  };
};

export const appHealthRow = (
  point: DataPoint,
  rank: number,
  href: string | null,
): CompactRow | null => {
  const project = strOf(point.dimensions?.project);
  const state = strOf(point.dimensions?.state);
  if (!project || !state) return null;
  const latency = numOf(point.dimensions?.latency_ms);
  const status = numOf(point.dimensions?.http_status);
  const subtitle =
    state === 'unconfigured'
      ? 'No server-approved endpoint'
      : `${status > 0 ? `HTTP ${String(Math.round(status))} · ` : ''}${Math.round(latency)} ms`;
  return {
    rank,
    title: projectLabel(project),
    subtitle,
    chip: state,
    chipTone: healthTone(state),
    href,
  };
};

export const webAnalyticsRow = (
  point: DataPoint,
  rank: number,
  href: string | null,
): CompactRow | null => {
  const host = strOf(point.dimensions?.host);
  const visits = Number(point.value);
  if (!host || !Number.isFinite(visits)) return null;
  const state = strOf(point.dimensions?.telemetry_state);
  return {
    rank,
    title: host,
    subtitle: activityComparison(
      visits,
      numOf(point.dimensions?.previous),
      numOf(point.dimensions?.change),
      state,
      strOf(point.dimensions?.last_seen),
      'visits',
    ),
    chip: `${Math.round(visits).toLocaleString('en-GB')} visits`,
    chipTone: visits > 0 ? 'ok' : state === 'unseen' ? 'warn' : 'muted',
    href,
  };
};

const healthTone = (state: string): CompactRow['chipTone'] => {
  if (state === 'healthy') return 'ok';
  if (state === 'degraded') return 'warn';
  if (state === 'down') return 'urgent';
  return 'muted';
};

const activityComparison = (
  current: number,
  previous: number,
  change: number,
  state: string | null,
  lastSeen: string | null,
  noun: string,
): string => {
  if (previous > 0) return `${change >= 0 ? '+' : ''}${Math.round(change)}% vs prior`;
  if (current > 0) return `new ${noun}`;
  if (state === 'unseen') return 'telemetry unseen';
  return lastSeen ? `quiet · last ${noun.replace(/s$/, '')} ${lastSeen}` : 'quiet';
};

const projectLabel = (project: string): string => {
  return project
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};
