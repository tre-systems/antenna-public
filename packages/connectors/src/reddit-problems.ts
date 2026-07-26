import { positiveInt, stringValue } from './config-values';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import { retryAfterSecondsFromHeaders } from './http-retry-after';
import { isProblemCandidate, parseRedditFeed, type RedditCandidate } from './reddit-feed';
import type { Adapter, AdapterError, AdapterResult, DataPoint } from './types';

export type RedditProblemsConfig = {
  readonly subreddits?: readonly string[];
  readonly lookbackHours?: number;
  readonly limit?: number;
  readonly minBodyChars?: number;
  readonly userAgent?: string;
};

// Anonymous feed access is metered at roughly one request per window, so a
// signal covering several subreddits rate-limits on every one after the first:
// configure one subreddit per signal and let refresh schedules spread the load.
const DEFAULT_SUBREDDITS = ['smallbusiness'] as const;
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_BODY_CHARS = 120;
const DEFAULT_USER_AGENT = 'antenna/1.0 (+https://antenna.example)';
const RATE_LIMIT_FALLBACK_SECONDS = 60;
const TITLE_MAX_CHARS = 140;

export const redditProblems: Adapter<RedditProblemsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const subreddits = subredditList(config.subreddits) ?? [...DEFAULT_SUBREDDITS];
  const lookbackHours = positiveInt(config.lookbackHours) ?? DEFAULT_LOOKBACK_HOURS;
  const limit = positiveInt(config.limit) ?? DEFAULT_LIMIT;
  const minBodyChars = positiveInt(config.minBodyChars) ?? DEFAULT_MIN_BODY_CHARS;
  const userAgent = stringValue(config.userAgent) ?? DEFAULT_USER_AGENT;

  const now = Date.now();
  const since = now - lookbackHours * 3_600_000;
  const candidates: RedditCandidate[] = [];
  const perSubreddit: Record<string, number> = {};
  const failures: { subreddit: string; message: string }[] = [];
  let rateLimited: number | undefined;

  for (const subreddit of subreddits) {
    const fetched = await fetchSubredditFeed(subreddit, userAgent);
    if (!fetched.ok) {
      if (fetched.error.code === 'rate_limited') {
        rateLimited = fetched.error.retryAfterSeconds ?? RATE_LIMIT_FALLBACK_SECONDS;
      }
      failures.push({ subreddit, message: fetched.error.message });
      continue;
    }
    const matched = parseRedditFeed(fetched.body, subreddit).filter(
      (post) => post.createdMs >= since && isProblemCandidate(post, minBodyChars),
    );
    perSubreddit[subreddit] = matched.length;
    candidates.push(...matched);
  }

  if (candidates.length === 0 && failures.length === subreddits.length) {
    return { ok: false, error: allFailedError(failures, rateLimited) };
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return {
    ok: true,
    points: [
      {
        dimensions: {
          source: 'reddit',
          metric: 'candidates',
          hours: lookbackHours,
          subreddits: subreddits.join(','),
        },
        value: ranked.length,
        unit: 'posts',
        ts: now,
        sourceUrl: `https://www.reddit.com/r/${subreddits.join('+')}/new/`,
      },
      ...subreddits
        .filter((subreddit) => subreddit in perSubreddit)
        .map((subreddit) => toSubredditPoint(subreddit, perSubreddit[subreddit] ?? 0, now)),
      ...ranked.slice(0, limit).map((entry, index) => toCandidatePoint(entry, index + 1, now)),
    ],
    rawPayload: {
      lookbackHours,
      subreddits,
      candidates: ranked,
      ...(failures.length > 0 ? { failures } : {}),
    },
  };
};

type FeedFetch =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly error: AdapterError };

// Reddit's JSON listing endpoints refuse anonymous requests (HTTP 403), so this
// reads the public Atom feed instead — no engagement fields, and hard rate
// limiting, hence the bespoke 429 handling rather than the shared fetchJson.
const fetchSubredditFeed = async (subreddit: string, userAgent: string): Promise<FeedFetch> => {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.rss`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/atom+xml, application/xml', 'User-Agent': userAgent },
    });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (response.status === 429) {
    const retryAfterSeconds = rateLimitRetrySeconds(response.headers);
    await discardResponse(response);
    return { ok: false, error: { code: 'rate_limited', message: 'HTTP 429', retryAfterSeconds } };
  }

  if (response.status === 403) {
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'fetch_failed', message: 'HTTP 403 — Reddit refused the anonymous feed' },
    };
  }

  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  try {
    return { ok: true, body: await response.text() };
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
};

// Reddit throttles with `x-ratelimit-reset` (seconds until the window clears)
// and sends no `retry-after`. Reporting the real reset lets the dispatcher
// reschedule instead of burning the next slot on a doomed retry.
export const rateLimitRetrySeconds = (headers: Headers): number => {
  const reset = Number(headers.get('x-ratelimit-reset'));
  const fallback =
    Number.isFinite(reset) && reset > 0
      ? Math.max(1, Math.ceil(reset))
      : RATE_LIMIT_FALLBACK_SECONDS;
  return retryAfterSecondsFromHeaders(headers, fallback);
};

const allFailedError = (
  failures: readonly { subreddit: string; message: string }[],
  rateLimited: number | undefined,
): AdapterError => {
  const message = failures.map((entry) => `r/${entry.subreddit}: ${entry.message}`).join('; ');
  return rateLimited === undefined
    ? { code: 'fetch_failed', message }
    : { code: 'rate_limited', message, retryAfterSeconds: rateLimited };
};

const toSubredditPoint = (subreddit: string, count: number, ts: number): DataPoint => ({
  dimensions: { source: 'reddit', metric: 'subreddit_candidates', subreddit },
  value: count,
  unit: 'posts',
  ts,
  sourceUrl: `https://www.reddit.com/r/${subreddit}/new/`,
});

const toCandidatePoint = (entry: RedditCandidate, rank: number, ts: number): DataPoint => ({
  dimensions: {
    source: 'reddit',
    metric: 'candidate',
    rank,
    subreddit: entry.subreddit,
    markers: entry.markerHits,
    signal: entry.score,
  },
  value: truncate(entry.title, TITLE_MAX_CHARS),
  unit: `r/${entry.subreddit} · ${entry.markerHits} markers`,
  ts,
  sourceUrl: entry.permalink,
});

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

const subredditList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const names = value.flatMap((entry) => {
    const name = stringValue(entry);
    return name ? [name.replace(/^\/?r\//i, '')] : [];
  });
  return names.length > 0 ? names : undefined;
};
