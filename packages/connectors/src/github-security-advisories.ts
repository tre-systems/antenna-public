import { positiveInt, stringValue } from './config-values';
import type { Adapter, AdapterResult } from './types';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import { githubAuthHeader, githubRateLimitError } from './github-http';
import {
  API_URL,
  countBySeverity,
  dedupeAdvisories,
  DEFAULT_ECOSYSTEM,
  DEFAULT_LIMIT,
  DEFAULT_LOOKBACK_DAYS,
  MAX_PER_SEVERITY,
  normaliseGithubSecurityAdvisories,
  normaliseSeverities,
  recentAdvisories,
  SOURCE_PAGE,
  toAdvisoryPoint,
  type NormalisedAdvisory,
} from './github-security-advisories-model';

export { normaliseGithubSecurityAdvisories, recentAdvisories };

type GithubSecurityAdvisoriesConfig = {
  readonly ecosystem?: string;
  readonly severities?: readonly string[];
  readonly lookbackDays?: number;
  readonly limit?: number;
  readonly githubToken?: string;
};

export const githubSecurityAdvisories: Adapter<GithubSecurityAdvisoriesConfig> = async (
  config,
): Promise<AdapterResult> => {
  const ecosystem = stringValue(config.ecosystem) ?? DEFAULT_ECOSYSTEM;
  const severities = normaliseSeverities(config.severities);
  const fetched: NormalisedAdvisory[] = [];
  const raw: unknown[] = [];

  for (const severity of severities) {
    const url = `${API_URL}?ecosystem=${encodeURIComponent(ecosystem)}&severity=${encodeURIComponent(
      severity,
    )}&per_page=${MAX_PER_SEVERITY}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'antenna',
          ...githubAuthHeader(config.githubToken),
        },
      });
    } catch (err) {
      return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
    }

    if (response.status === 403 || response.status === 429) {
      await discardResponse(response);
      return { ok: false, error: githubRateLimitError(response, 'GitHub advisory API rate limit') };
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

    if (!Array.isArray(body)) {
      return { ok: false, error: { code: 'parse_failed', message: 'expected advisory array' } };
    }
    for (const item of body as unknown[]) raw.push(item);
    fetched.push(...normaliseGithubSecurityAdvisories(body));
  }

  const lookbackDays = positiveInt(config.lookbackDays) ?? DEFAULT_LOOKBACK_DAYS;
  const limit = positiveInt(config.limit) ?? DEFAULT_LIMIT;
  const now = Date.now();
  const recent = recentAdvisories(dedupeAdvisories(fetched), lookbackDays, now);

  return {
    ok: true,
    points: [
      {
        dimensions: {
          source: 'github-advisory-api',
          ecosystem,
          metric: 'recent_high_or_critical',
          days: lookbackDays,
        },
        value: recent.length,
        unit: 'advisories',
        ts: now,
        sourceUrl: SOURCE_PAGE,
      },
      ...countBySeverity(recent).map(([severity, count]) => ({
        dimensions: {
          source: 'github-advisory-api',
          ecosystem,
          metric: 'recent_by_severity',
          severity,
          days: lookbackDays,
        },
        value: count,
        unit: 'advisories',
        ts: now,
        sourceUrl: `${SOURCE_PAGE}?query=ecosystem%3A${encodeURIComponent(ecosystem)}+severity%3A${encodeURIComponent(
          severity,
        )}`,
      })),
      ...recent
        .slice(0, limit)
        .map((advisory, index) => toAdvisoryPoint(advisory, ecosystem, index + 1, now)),
    ],
    rawPayload: {
      source: API_URL,
      sourcePage: SOURCE_PAGE,
      ecosystem,
      severities,
      lookbackDays,
      recent,
      fetched: raw.length,
    },
  };
};
