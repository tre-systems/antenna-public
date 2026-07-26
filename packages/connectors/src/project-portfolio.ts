import { ACCOUNT_ID_RX, analyticsSqlUrl, SLUG_RX } from './analytics-engine';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult, DataPoint } from './types';

export type ProjectPortfolioConfig = {
  readonly projects: string;
  readonly accountId: string;
  readonly apiToken: string;
  readonly days?: number;
  readonly dataset?: string;
};

type SqlRow = {
  readonly project: string;
  readonly day: string;
  readonly event: string;
  readonly count: number | string;
};

const DEFAULT_DATASET = 'app_usage';
const DEFAULT_DAYS = 7;

export const projectPortfolio: Adapter<ProjectPortfolioConfig> = async (
  config,
): Promise<AdapterResult> => {
  const projects = config.projects
    .split(',')
    .map((project) => project.trim())
    .filter(Boolean);
  const accountId = config.accountId.trim();
  const dataset = (config.dataset ?? DEFAULT_DATASET).trim();
  const days = Math.min(30, Math.max(1, Math.trunc(config.days ?? DEFAULT_DAYS)));
  if (projects.length === 0 || projects.some((project) => !SLUG_RX.test(project))) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid project list' } };
  }
  if (!ACCOUNT_ID_RX.test(accountId) || !SLUG_RX.test(dataset)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid analytics config' } };
  }
  if (config.apiToken.trim().length === 0) {
    return { ok: false, error: { code: 'unauthorized', message: 'missing analytics API token' } };
  }

  const sql = [
    `SELECT index1 AS project,`,
    `toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,`,
    `blob1 AS event, SUM(_sample_interval * double1) AS count`,
    `FROM ${dataset}`,
    `WHERE timestamp > NOW() - INTERVAL '${String(days * 2)}' DAY`,
    `GROUP BY project, day, event`,
    `ORDER BY day DESC, count DESC FORMAT JSON`,
  ].join(' ');
  const response = await fetchPortfolio(accountId, config.apiToken, sql);
  if (!response.ok) return response;

  const rows = readRows(response.payload);
  if (!rows) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected SQL API payload' } };
  }
  const points = portfolioPoints(projects, rows, days);
  return { ok: true, points, rawPayload: { dataset, days, rows } };
};

const fetchPortfolio = async (
  accountId: string,
  apiToken: string,
  sql: string,
): Promise<
  { readonly ok: true; readonly payload: unknown } | Extract<AdapterResult, { readonly ok: false }>
> => {
  let response: Response;
  try {
    response = await fetch(analyticsSqlUrl(accountId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: sql,
    });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: { code: 'unauthorized', message: `HTTP ${response.status}` } };
  }
  if (response.status === 429) {
    return { ok: false, error: { code: 'rate_limited', message: 'analytics API rate limit' } };
  }
  if (!response.ok) {
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }
  try {
    return { ok: true, payload: await response.json() };
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
};

const readRows = (payload: unknown): SqlRow[] | null => {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data.filter((row): row is SqlRow => {
    if (typeof row !== 'object' || row === null) return false;
    const value = row as Record<string, unknown>;
    return (
      typeof value.project === 'string' &&
      typeof value.day === 'string' &&
      typeof value.event === 'string' &&
      (typeof value.count === 'number' || typeof value.count === 'string')
    );
  });
};

const portfolioPoints = (
  projects: readonly string[],
  rows: readonly SqlRow[],
  days: number,
): DataPoint[] => {
  const now = Date.now();
  const recentCutoff = now - days * 86_400_000;
  return projects.map((project, rank) => {
    let recent = 0;
    let previous = 0;
    const events = new Map<string, number>();
    for (const row of rows) {
      if (row.project !== project) continue;
      const count = Number(row.count);
      const observedAt = Date.parse(`${row.day.slice(0, 10)}T00:00:00Z`);
      if (!Number.isFinite(count) || !Number.isFinite(observedAt)) continue;
      if (observedAt >= recentCutoff) {
        recent += count;
        events.set(row.event, (events.get(row.event) ?? 0) + count);
      } else {
        previous += count;
      }
    }
    const topEvent = [...events].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '';
    const change = previous > 0 ? ((recent - previous) / previous) * 100 : recent > 0 ? 100 : 0;
    return {
      dimensions: {
        metric: 'project_activity',
        rank: rank + 1,
        project,
        previous: Math.round(previous),
        change: Math.round(change),
        top_event: topEvent,
        days,
      },
      value: Math.round(recent),
      unit: 'events',
      ts: now,
    };
  });
};
