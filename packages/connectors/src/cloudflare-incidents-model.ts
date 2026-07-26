import { stringValue } from './config-values';

type StatuspageIncident = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly status?: unknown;
  readonly impact?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
  readonly started_at?: unknown;
  readonly resolved_at?: unknown;
  readonly shortlink?: unknown;
  readonly components?: unknown;
};

type StatuspageComponent = {
  readonly name?: unknown;
};

type StatuspageResponse = {
  readonly incidents?: unknown;
};

export type NormalisedIncident = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly impact: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly startedAt?: string;
  readonly resolvedAt?: string;
  readonly sourceUrl: string;
  readonly components: readonly string[];
};

export const SOURCE_PAGE = 'https://www.cloudflarestatus.com/';
export const ACTIVE_STATUSES = new Set(['investigating', 'identified', 'monitoring']);

export const normaliseCloudflareIncidents = (body: unknown): NormalisedIncident[] => {
  if (!body || typeof body !== 'object') return [];
  const rows = (body as StatuspageResponse).incidents;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const parsed = normaliseIncident(row as StatuspageIncident);
    return parsed ? [parsed] : [];
  });
};

export const activeIncidents = (incidents: readonly NormalisedIncident[]): NormalisedIncident[] =>
  incidents
    .filter((incident) => ACTIVE_STATUSES.has(incident.status))
    .sort(
      (a, b) => severityRank(b.impact) - severityRank(a.impact) || b.updatedAtMs - a.updatedAtMs,
    );

export const recentIncidents = (
  incidents: readonly NormalisedIncident[],
  lookbackHours: number,
  now: number,
): NormalisedIncident[] => {
  const since = now - lookbackHours * 3_600_000;
  return incidents
    .filter((incident) => incident.createdAtMs >= since && incident.createdAtMs <= now)
    .sort((a, b) => b.createdAtMs - a.createdAtMs || a.name.localeCompare(b.name));
};

const normaliseIncident = (incident: StatuspageIncident): NormalisedIncident | null => {
  const id = stringValue(incident.id);
  const name = stringValue(incident.name);
  const status = stringValue(incident.status)?.toLowerCase();
  const impact = stringValue(incident.impact)?.toLowerCase() ?? 'unknown';
  const createdAt = stringValue(incident.created_at);
  const updatedAt = stringValue(incident.updated_at);
  const createdAtMs = createdAt ? Date.parse(createdAt) : NaN;
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!id || !name || !status || !Number.isFinite(createdAtMs) || !Number.isFinite(updatedAtMs)) {
    return null;
  }

  return {
    id,
    name,
    status,
    impact,
    createdAtMs,
    updatedAtMs,
    sourceUrl: stringValue(incident.shortlink) ?? SOURCE_PAGE,
    components: componentNames(incident.components),
    ...(stringValue(incident.started_at) ? { startedAt: stringValue(incident.started_at) } : {}),
    ...(stringValue(incident.resolved_at) ? { resolvedAt: stringValue(incident.resolved_at) } : {}),
  };
};

const componentNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const name = stringValue((entry as StatuspageComponent).name);
    return name ? [name] : [];
  });
};

const severityRank = (impact: string): number => {
  if (impact === 'critical') return 4;
  if (impact === 'major') return 3;
  if (impact === 'minor') return 2;
  if (impact === 'none') return 1;
  return 0;
};
