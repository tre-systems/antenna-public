import type { Adapter, AdapterResult, DataPoint } from './types';
import { discardResponse } from './discard-response';
import { githubRateLimitError } from './github-rate-limit';

type TrendingWindow = 'daily' | 'weekly' | 'monthly';

type GithubTrendingConfig = {
  readonly since?: TrendingWindow;
  readonly limit?: number;
  readonly githubToken?: string;
};

export type GithubTrendingRepo = {
  readonly rank: number;
  readonly repo: string;
  readonly description?: string;
  readonly language?: string;
  readonly stars?: number;
  readonly forks?: number;
  readonly starsToday?: number;
  readonly url: string;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_SINCE: TrendingWindow = 'daily';
const TRENDING_URL = 'https://github.com/trending';

export const githubTrending: Adapter<GithubTrendingConfig> = async (
  config,
): Promise<AdapterResult> => {
  const since = normaliseSince(config.since);
  const limit = normaliseLimit(config.limit);
  const url = `${TRENDING_URL}?since=${encodeURIComponent(since)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'antenna',
        Accept: 'text/html,application/xhtml+xml',
        ...githubAuthHeader(config.githubToken),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (response.status === 403 || response.status === 429) {
    await discardResponse(response);
    return {
      ok: false,
      error: githubRateLimitError(response, 'GitHub trending rate limit'),
    };
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  const repos = parseGithubTrending(html).slice(0, limit);
  if (repos.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no trending repos parsed' } };
  }

  const ts = Date.now();
  return {
    ok: true,
    points: repos.map((repo) => toPoint(repo, ts)),
    rawPayload: { source: url, since, repos },
  };
};

export const parseGithubTrending = (html: string): GithubTrendingRepo[] => {
  const articles = html.split(/<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>/i).slice(1);
  const repos: GithubTrendingRepo[] = [];

  for (const article of articles) {
    const repo = parseRepo(article, repos.length + 1);
    if (repo) repos.push(repo);
  }

  return repos;
};

const parseRepo = (article: string, rank: number): GithubTrendingRepo | undefined => {
  const href = matchFirst(article, /<h2\b[\s\S]*?<a\b[^>]*href="\/([^"]+\/[^"]+)"[^>]*>/i);
  if (!href) return undefined;
  const repo = normaliseText(href);
  const description = matchFirst(
    article,
    /<p\b[^>]*class="[^"]*\bcolor-fg-muted\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
  );
  const language = matchFirst(article, /itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/i);
  const starsToday = parseNumber(
    matchFirst(article, /([\d,]+)\s+stars?\s+today/i) ??
      matchFirst(article, /([\d,]+)\s+stars?\s+this\s+week/i) ??
      matchFirst(article, /([\d,]+)\s+stars?\s+this\s+month/i),
  );

  const stats = [...article.matchAll(/class="[^"]*\bLink--muted\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => normaliseText(match[1] ?? ''))
    .map(parseNumber)
    .filter((n): n is number => n !== undefined);

  return {
    rank,
    repo,
    ...(description ? { description: normaliseText(description) } : {}),
    ...(language ? { language: normaliseText(language) } : {}),
    ...(stats[0] !== undefined ? { stars: stats[0] } : {}),
    ...(stats[1] !== undefined ? { forks: stats[1] } : {}),
    ...(starsToday !== undefined ? { starsToday } : {}),
    url: `https://github.com/${repo}`,
  };
};

const toPoint = (repo: GithubTrendingRepo, ts: number): DataPoint => {
  const parts = [repo.repo];
  if (repo.language) parts.push(repo.language);
  if (repo.starsToday !== undefined)
    parts.push(`+${repo.starsToday.toLocaleString('en-US')} stars today`);
  // No per-point sourceUrl: the registry derives the per-repo URL from the
  // value text (display.ts pointSourceUrl). Setting one here would also become
  // the signal-level source URL — the first non-empty point URL wins there —
  // pointing the card's "view source" at repo #1 instead of the trending list.
  return {
    dimensions: { source: 'github-trending', rank: repo.rank },
    value: parts.join(' · '),
    ts,
  };
};

const normaliseSince = (value: unknown): TrendingWindow => {
  return value === 'weekly' || value === 'monthly' || value === 'daily' ? value : DEFAULT_SINCE;
};

const normaliseLimit = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
};

const matchFirst = (input: string, rx: RegExp): string | undefined => rx.exec(input)?.[1];

const parseNumber = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(value) ? value : undefined;
};

const normaliseText = (html: string): string =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');

const githubAuthHeader = (token: string | undefined): Record<string, string> =>
  typeof token === 'string' && token.trim().length > 0 ? { Authorization: `Bearer ${token}` } : {};
