import { isFiniteNumber } from './config-values';
import type { DataPoint } from './types';

export type RumRow = {
  readonly count: number;
  readonly sum: { readonly visits: number };
  readonly dimensions: { readonly date: string; readonly requestHost: string };
};

type TrafficTotals = {
  recentVisits: number;
  previousVisits: number;
  recentPageloads: number;
  lastSeen: string;
};

const emptyTotals = (): TrafficTotals => ({
  recentVisits: 0,
  previousVisits: 0,
  recentPageloads: 0,
  lastSeen: '',
});

export const readRumRows = (payload: unknown): RumRow[] | null => {
  if (typeof payload !== 'object' || payload === null) return null;
  const accounts = (payload as { data?: { viewer?: { accounts?: unknown } } }).data?.viewer
    ?.accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  const rows = (accounts[0] as { rumPageloadEventsAdaptiveGroups?: unknown })
    .rumPageloadEventsAdaptiveGroups;
  return Array.isArray(rows) ? rows.filter(isRumRow) : null;
};

const isRumRow = (row: unknown): row is RumRow => {
  if (typeof row !== 'object' || row === null) return false;
  const candidate = row as Record<string, unknown>;
  const sum = candidate.sum as Record<string, unknown> | undefined;
  const dimensions = candidate.dimensions as Record<string, unknown> | undefined;
  return (
    isFiniteNumber(candidate.count) &&
    isFiniteNumber(sum?.visits) &&
    typeof dimensions?.date === 'string' &&
    typeof dimensions.requestHost === 'string'
  );
};

export const hostTrafficPoints = (
  hosts: readonly string[],
  rows: readonly RumRow[],
  days: number,
  now: Date,
): DataPoint[] => {
  const recentBoundary = daysBefore(now, days - 1);
  const previousBoundary = daysBefore(now, days * 2 - 1);
  const totals = aggregateTraffic(rows, new Set(hosts), recentBoundary, previousBoundary);
  return hosts.map((host, rank) => trafficPoint(host, rank + 1, totals.get(host), days, now));
};

const aggregateTraffic = (
  rows: readonly RumRow[],
  hosts: ReadonlySet<string>,
  recentBoundary: string,
  previousBoundary: string,
): Map<string, TrafficTotals> => {
  const byHost = new Map<string, TrafficTotals>();
  for (const row of rows) {
    const host = row.dimensions.requestHost.toLowerCase();
    if (!hosts.has(host)) continue;
    const totals = byHost.get(host) ?? emptyTotals();
    totals.lastSeen = row.dimensions.date > totals.lastSeen ? row.dimensions.date : totals.lastSeen;
    addRow(totals, row, recentBoundary, previousBoundary);
    byHost.set(host, totals);
  }
  return byHost;
};

const addRow = (
  totals: TrafficTotals,
  row: RumRow,
  recentBoundary: string,
  previousBoundary: string,
): void => {
  if (row.dimensions.date >= recentBoundary) {
    totals.recentVisits += row.sum.visits;
    totals.recentPageloads += row.count;
  } else if (row.dimensions.date >= previousBoundary) {
    totals.previousVisits += row.sum.visits;
  }
};

const trafficPoint = (
  host: string,
  rank: number,
  totals = emptyTotals(),
  days: number,
  now: Date,
): DataPoint => ({
  dimensions: {
    metric: 'host_traffic',
    rank,
    host,
    previous: Math.round(totals.previousVisits),
    change: percentageChange(totals.recentVisits, totals.previousVisits),
    pageloads: Math.round(totals.recentPageloads),
    last_seen: totals.lastSeen,
    telemetry_state: totals.recentVisits > 0 ? 'active' : totals.lastSeen ? 'quiet' : 'unseen',
    days,
  },
  value: Math.round(totals.recentVisits),
  unit: 'visits',
  ts: now.getTime(),
  sourceUrl: `https://${host}/`,
});

const percentageChange = (recent: number, previous: number): number => {
  if (previous > 0) return Math.round(((recent - previous) / previous) * 100);
  return recent > 0 ? 100 : 0;
};

const daysBefore = (date: Date, days: number): string => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy.toISOString().slice(0, 10);
};
