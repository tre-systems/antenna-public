import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import { githubAuthHeader, githubRateLimitError } from './github-http';
import { isFiniteNumber } from './config-values';
import type { Adapter, AdapterResult, DataPoint } from './types';

type GithubConfig = { owner: string; repo: string; githubToken?: string };

type RepoResponse = {
  stargazers_count?: number;
  open_issues_count?: number;
  forks_count?: number;
};

export const githubRepo: Adapter<GithubConfig> = async (config): Promise<AdapterResult> => {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'antenna',
        Accept: 'application/vnd.github+json',
        ...githubAuthHeader(config.githubToken),
      },
    });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (response.status === 403) {
    await discardResponse(response);
    return {
      ok: false,
      error: githubRateLimitError(response, 'GitHub rate limit'),
    };
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }

  const points = buildPoints(body, config);
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected response shape' } };
  }
  return { ok: true, points, rawPayload: body };
};

const buildPoints = (body: unknown, config: GithubConfig): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const repo = `${config.owner}/${config.repo}`;
  const ts = Date.now();
  const data = body as RepoResponse;
  const points: DataPoint[] = [];

  if (isFiniteNumber(data.stargazers_count)) {
    points.push({ dimensions: { repo, metric: 'stars' }, value: data.stargazers_count, ts });
  }
  if (isFiniteNumber(data.open_issues_count)) {
    points.push({
      dimensions: { repo, metric: 'open_issues' },
      value: data.open_issues_count,
      ts,
    });
  }
  if (isFiniteNumber(data.forks_count)) {
    points.push({ dimensions: { repo, metric: 'forks' }, value: data.forks_count, ts });
  }
  return points;
};
