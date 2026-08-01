import { ACCOUNT_ID_RX, analyticsSqlUrl, SLUG_RX } from './analytics-engine';
import { boundedInt } from './config-values';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult, DataPoint } from './types';

// Events come from the Antenna beacon or direct Analytics Engine writes.

type AppUsageConfig = {
  readonly project: string;
  readonly accountId: string;
  readonly apiToken: string;
  readonly days?: number;
  readonly dataset?: string;
};

type SqlRow = {
  readonly day: string;
  readonly event: string;
  readonly count: number | string;
};

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const DEFAULT_DATASET = 'app_usage';

export const appUsage: Adapter<AppUsageConfig> = async (config): Promise<AdapterResult> => {
  const project = config.project.trim();
  const accountId = config.accountId.trim();
  const apiToken = config.apiToken.trim();
  const dataset = (config.dataset ?? DEFAULT_DATASET).trim();
  const days = boundedInt(config.days, DEFAULT_DAYS, 1, MAX_DAYS);

  if (!SLUG_RX.test(project)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid project slug' } };
  }
  if (!SLUG_RX.test(dataset)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid dataset name' } };
  }
  if (!ACCOUNT_ID_RX.test(accountId)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid account id' } };
  }
  if (apiToken.length === 0) {
    return { ok: false, error: { code: 'unauthorized', message: 'missing analytics API token' } };
  }

  // The sample interval recovers true event counts from sampled rows.
  const sql = [
    `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,`,
    `blob1 AS event,`,
    `SUM(_sample_interval * double1) AS count`,
    `FROM ${dataset}`,
    `WHERE index1 = '${project}'`,
    `AND timestamp > NOW() - INTERVAL '${days}' DAY`,
    `GROUP BY day, event`,
    `ORDER BY day DESC, count DESC`,
    `FORMAT JSON`,
  ].join(' ');

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
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'unauthorized', message: `analytics SQL API HTTP ${response.status}` },
    };
  }
  if (response.status === 429) {
    await discardResponse(response);
    return { ok: false, error: { code: 'rate_limited', message: 'analytics SQL API rate limit' } };
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }

  const rows = readRows(payload);
  if (rows === undefined) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected SQL API payload' } };
  }

  const points = rows
    .map((row) => toPoint(row, project))
    .filter((point): point is DataPoint => point !== undefined);

  // A zero point keeps a quiet app live rather than stale.
  if (points.length === 0) {
    points.push({
      dimensions: { source: 'app-usage', project, event: 'total', day: today() },
      value: 0,
      unit: 'events',
      ts: Date.now(),
    });
  }

  return { ok: true, points, rawPayload: { project, dataset, days, rows } };
};

const readRows = (payload: unknown): SqlRow[] | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  return data.filter(isSqlRow);
};

const isSqlRow = (row: unknown): row is SqlRow => {
  if (typeof row !== 'object' || row === null) return false;
  const candidate = row as Record<string, unknown>;
  return (
    typeof candidate.day === 'string' &&
    typeof candidate.event === 'string' &&
    (typeof candidate.count === 'number' || typeof candidate.count === 'string')
  );
};

const toPoint = (row: SqlRow, project: string): DataPoint | undefined => {
  const count = typeof row.count === 'string' ? Number(row.count) : row.count;
  if (!Number.isFinite(count)) return undefined;
  const day = row.day.slice(0, 10);
  const ts = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ts)) return undefined;
  return {
    dimensions: { source: 'app-usage', project, event: row.event, day },
    value: Math.round(count),
    unit: 'events',
    ts,
  };
};

const today = (): string => new Date().toISOString().slice(0, 10);
