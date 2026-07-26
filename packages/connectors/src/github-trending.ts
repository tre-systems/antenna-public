import type { Adapter, AdapterResult, DataPoint } from './types';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import { githubAuthHeader, githubRateLimitError } from './github-http';
import { extractHtmlElements, hasHtmlClass, htmlAttribute, htmlToText } from './html-text';

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
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (response.status === 403 || response.status === 429) {
    await discardResponse(response);
    return { ok: false, error: githubRateLimitError(response, 'GitHub trending rate limit') };
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
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
  const articles = extractHtmlElements(html, 'article').filter((article) =>
    hasHtmlClass(article.openingTag, 'Box-row'),
  );
  const repos: GithubTrendingRepo[] = [];

  for (const article of articles) {
    const repo = parseRepo(article.innerHtml, repos.length + 1);
    if (repo) repos.push(repo);
  }

  return repos;
};

const parseRepo = (article: string, rank: number): GithubTrendingRepo | undefined => {
  const repo = repositoryName(article);
  if (repo === undefined) return undefined;
  const description = extractHtmlElements(article, 'p').find((element) =>
    hasHtmlClass(element.openingTag, 'color-fg-muted'),
  )?.innerHtml;
  const language = extractHtmlElements(article, 'span').find(
    (element) => htmlAttribute(element.openingTag, 'itemprop') === 'programmingLanguage',
  )?.innerHtml;
  const text = htmlToText(article);
  const starsToday = parseNumber(
    matchFirst(text, /([\d,]+)\s+stars?\s+today/i) ??
      matchFirst(text, /([\d,]+)\s+stars?\s+this\s+week/i) ??
      matchFirst(text, /([\d,]+)\s+stars?\s+this\s+month/i),
  );

  const stats = extractHtmlElements(article, 'a')
    .filter((element) => hasHtmlClass(element.openingTag, 'Link--muted'))
    .map((element) => htmlToText(element.innerHtml))
    .map(parseNumber)
    .filter((n): n is number => n !== undefined);

  return {
    rank,
    repo,
    ...(description ? { description: htmlToText(description) } : {}),
    ...(language ? { language: htmlToText(language) } : {}),
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
  // No per-point sourceUrl: display.ts derives it, and the first non-empty one
  // would also become the card's signal-level source URL.
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

// A trending row links to `/owner/repo`; anything else on the page is not a
// repository, so the shape is checked rather than pattern-matched out of markup.
const repositoryName = (article: string): string | undefined => {
  const heading = extractHtmlElements(article, 'h2')[0];
  const anchor = heading ? extractHtmlElements(heading.innerHtml, 'a')[0] : undefined;
  const href = anchor ? htmlAttribute(anchor.openingTag, 'href') : undefined;
  if (!href?.startsWith('/')) return undefined;

  const [owner, repo, extra] = href.slice(1).split('/');
  if (!owner || !repo || extra !== undefined) return undefined;
  if (!isRepositorySegment(owner) || !isRepositorySegment(repo)) return undefined;
  return `${owner}/${repo}`;
};

const isRepositorySegment = (value: string): boolean => /^[A-Za-z0-9_.-]+$/.test(value);

const parseNumber = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(value) ? value : undefined;
};
