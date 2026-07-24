import type { DataPoint } from './types';

type GithubAdvisoryResponse = {
  readonly ghsa_id?: unknown;
  readonly cve_id?: unknown;
  readonly html_url?: unknown;
  readonly summary?: unknown;
  readonly severity?: unknown;
  readonly published_at?: unknown;
  readonly updated_at?: unknown;
  readonly vulnerabilities?: unknown;
};

type GithubVulnerability = {
  readonly package?: unknown;
};

type GithubPackage = {
  readonly name?: unknown;
};

export type NormalisedAdvisory = {
  readonly ghsaId: string;
  readonly cveId?: string;
  readonly summary: string;
  readonly severity: string;
  readonly publishedAt: string;
  readonly publishedAtMs: number;
  readonly updatedAt?: string;
  readonly sourceUrl: string;
  readonly packages: readonly string[];
};

export const SOURCE_PAGE = 'https://github.com/advisories';
export const API_URL = 'https://api.github.com/advisories';
export const DEFAULT_ECOSYSTEM = 'npm';
export const DEFAULT_SEVERITIES = ['critical', 'high'] as const;
export const DEFAULT_LOOKBACK_DAYS = 7;
export const DEFAULT_LIMIT = 3;
export const MAX_PER_SEVERITY = 30;

export const githubAuthHeader = (token: string | undefined): Record<string, string> =>
  typeof token === 'string' && token.trim().length > 0 ? { Authorization: `Bearer ${token}` } : {};

export const normaliseGithubSecurityAdvisories = (body: unknown): NormalisedAdvisory[] => {
  if (!Array.isArray(body)) return [];
  return body.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const parsed = normaliseAdvisory(entry as GithubAdvisoryResponse);
    return parsed ? [parsed] : [];
  });
};

export const recentAdvisories = (
  advisories: readonly NormalisedAdvisory[],
  lookbackDays: number,
  now: number,
): NormalisedAdvisory[] => {
  const since = now - lookbackDays * 86_400_000;
  return advisories
    .filter((advisory) => advisory.publishedAtMs >= since && advisory.publishedAtMs <= now)
    .sort(
      (a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        b.publishedAtMs - a.publishedAtMs ||
        a.ghsaId.localeCompare(b.ghsaId),
    );
};

export const dedupeAdvisories = (
  advisories: readonly NormalisedAdvisory[],
): readonly NormalisedAdvisory[] => {
  const seen = new Map<string, NormalisedAdvisory>();
  for (const advisory of advisories) {
    if (!seen.has(advisory.ghsaId)) seen.set(advisory.ghsaId, advisory);
  }
  return [...seen.values()];
};

export const countBySeverity = (
  advisories: readonly NormalisedAdvisory[],
): Array<[string, number]> =>
  DEFAULT_SEVERITIES.map((severity) => [
    severity,
    advisories.filter((advisory) => advisory.severity === severity).length,
  ]);

export const toAdvisoryPoint = (
  advisory: NormalisedAdvisory,
  ecosystem: string,
  rank: number,
  ts: number,
): DataPoint => ({
  dimensions: {
    source: 'github-advisory-api',
    ecosystem,
    metric: 'advisory',
    rank,
    severity: advisory.severity,
    ghsa: advisory.ghsaId,
    cve: advisory.cveId ?? '',
    packages: advisory.packages.slice(0, 3).join(', '),
  },
  value: `${advisory.severity.toUpperCase()} · ${advisory.summary}`,
  unit: advisory.packages.slice(0, 3).join(', ') || undefined,
  ts,
  sourceUrl: advisory.sourceUrl,
});

export const normaliseSeverities = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return DEFAULT_SEVERITIES;
  const allowed = value
    .map((item) => stringValue(item)?.toLowerCase())
    .filter((item): item is string => item === 'critical' || item === 'high');
  return allowed.length ? [...new Set(allowed)] : DEFAULT_SEVERITIES;
};

export const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const positiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const normaliseAdvisory = (advisory: GithubAdvisoryResponse): NormalisedAdvisory | null => {
  const ghsaId = stringValue(advisory.ghsa_id);
  const summary = stringValue(advisory.summary);
  const severity = stringValue(advisory.severity)?.toLowerCase();
  const publishedAt = stringValue(advisory.published_at);
  const publishedAtMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const sourceUrl = stringValue(advisory.html_url);
  if (!ghsaId || !summary || !severity || !publishedAt || !Number.isFinite(publishedAtMs)) {
    return null;
  }

  return {
    ghsaId,
    summary,
    severity,
    publishedAt,
    publishedAtMs,
    sourceUrl: sourceUrl ?? `${SOURCE_PAGE}/${ghsaId}`,
    packages: packageNames(advisory.vulnerabilities),
    ...(stringValue(advisory.cve_id) ? { cveId: stringValue(advisory.cve_id) } : {}),
    ...(stringValue(advisory.updated_at) ? { updatedAt: stringValue(advisory.updated_at) } : {}),
  };
};

const packageNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const names = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const vulnerability = entry as GithubVulnerability;
    const pkg = vulnerability.package;
    if (!pkg || typeof pkg !== 'object') return [];
    const name = stringValue((pkg as GithubPackage).name);
    return name ? [name] : [];
  });
  return [...new Set(names)];
};

const severityRank = (severity: string): number => {
  if (severity === 'critical') return 2;
  if (severity === 'high') return 1;
  return 0;
};
