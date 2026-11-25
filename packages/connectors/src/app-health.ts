import { SLUG_RX } from './analytics-engine';
import { commaSeparatedValues } from './config-values';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult, DataPoint } from './types';

export type AppHealthConfig = {
  readonly projects: string;
  readonly manifest: string;
};

const TIMEOUT_MS = 8_000;

export const appHealth: Adapter<AppHealthConfig> = async (config): Promise<AdapterResult> => {
  const projects = commaSeparatedValues(config.projects);
  if (projects.length === 0 || projects.some((project) => !SLUG_RX.test(project))) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid project list' } };
  }

  const manifest = readManifest(config.manifest);
  if (manifest === null) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid health manifest' } };
  }

  const points = await Promise.all(
    projects.map((project, rank) => probeProject(project, rank + 1, manifest[project])),
  );
  const unavailable = points.filter((point) => point.value === 'unknown').length;
  return {
    ok: true,
    points,
    rawPayload: { checked: projects.length },
    ...(unavailable > 0
      ? {
          warning: {
            code: 'fetch_failed' as const,
            message: `${String(unavailable)} health probes unavailable; application availability is unknown`,
          },
        }
      : {}),
  };
};

const readManifest = (value: string): Readonly<Record<string, string>> | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const manifest: Record<string, string> = {};
  for (const [project, candidate] of Object.entries(parsed)) {
    if (!SLUG_RX.test(project) || typeof candidate !== 'string') return null;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    manifest[project] = url.toString();
  }
  return manifest;
};

const probeProject = async (
  project: string,
  rank: number,
  url: string | undefined,
): Promise<DataPoint> => {
  const startedAt = Date.now();
  if (url === undefined) return healthPoint(project, rank, 'unconfigured', 0, 0, startedAt);

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json,text/plain,text/html;q=0.5' },
    });
    const latency = Date.now() - startedAt;
    const state = responseState(response, latency);
    await discardResponse(response);
    return healthPoint(project, rank, state, response.status, latency, startedAt, url);
  } catch (err) {
    const message = errorMessage(err).slice(0, 120);
    return healthPoint(
      project,
      rank,
      'probe_error',
      0,
      Date.now() - startedAt,
      startedAt,
      url,
      message,
    );
  }
};

const responseState = (response: Response, latency: number): string => {
  if (response.ok) return latency >= 2_000 ? 'degraded' : 'healthy';
  if (response.status >= 300 && response.status < 400) return 'redirect';
  return response.status >= 400 ? 'down' : 'probe_error';
};

const healthPoint = (
  project: string,
  rank: number,
  state: string,
  httpStatus: number,
  latencyMs: number,
  ts: number,
  sourceUrl?: string,
  error?: string,
): DataPoint => ({
  dimensions: {
    metric: 'app_health',
    rank,
    project,
    state,
    http_status: httpStatus,
    latency_ms: latencyMs,
    ...(error ? { error } : {}),
  },
  value: state === 'healthy' || state === 'degraded' ? 1 : state === 'down' ? 0 : 'unknown',
  unit: 'available',
  ts,
  sourceUrl,
});
