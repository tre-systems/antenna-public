import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  candidateScore,
  isProblemCandidate,
  parseRedditFeed,
  type RedditCandidate,
} from './reddit-feed';
import { rateLimitRetrySeconds, redditProblems } from './reddit-problems';

const NOW = Date.parse('2026-07-25T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

const PROBLEM_BODY =
  'Every month I rebuild the same invoice summary by hand from three exports. It takes hours and I always fat-finger a total somewhere. Is there a tool that just does this for me?';

// Content arrives HTML-escaped inside the XML, exactly as Reddit serves it.
const escapeHtml = (html: string) =>
  html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const entry = (
  overrides: {
    id?: string;
    title?: string;
    body?: string;
    subreddit?: string;
    published?: string;
    author?: string;
  } = {},
) => {
  const id = overrides.id ?? 'abc123';
  const subreddit = overrides.subreddit ?? 'smallbusiness';
  const author = overrides.author ?? 'Inner_Dragonfly7388';
  const published = overrides.published ?? hoursAgo(3);
  // Reddit closes every body with SC_ON and then appends a "submitted by"
  // footer carrying the author handle. Link-only posts have the footer alone.
  const body =
    overrides.body === ''
      ? ''
      : `<!-- SC_OFF --><div class="md"><p>${overrides.body ?? PROBLEM_BODY}</p></div>`;
  const footer = `<!-- SC_ON --> &#32; submitted by &#32; <a href="https://www.reddit.com/user/${author}"> /u/${author} </a> <br/> <span><a href="https://www.reddit.com/r/${subreddit}/comments/${id}/slug/">[link]</a></span>`;
  return `<entry><author><name>/u/${author}</name><uri>https://www.reddit.com/user/${author}</uri></author><category term="${subreddit}" label="r/${subreddit}"/><content type="html">${escapeHtml(`${body}${footer}`)}</content><id>t3_${id}</id><link href="https://www.reddit.com/r/${subreddit}/comments/${id}/slug/" /><updated>${published}</updated><published>${published}</published><title>${overrides.title ?? 'How do I stop rebuilding this invoice sheet every month?'}</title></entry>`;
};

const feed = (entries: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>new posts</title>${entries.join('')}</feed>`;

const okResponse = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'application/atom+xml' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseRedditFeed', () => {
  it('extracts id, subreddit, permalink and publish time from an Atom entry', () => {
    const [parsed] = parseRedditFeed(feed([entry()]), 'smallbusiness');
    expect(parsed?.id).toBe('abc123');
    expect(parsed?.subreddit).toBe('smallbusiness');
    expect(parsed?.permalink).toBe('https://www.reddit.com/r/smallbusiness/comments/abc123/slug/');
    expect(parsed?.createdMs).toBe(Date.parse(hoursAgo(3)));
    expect(parsed?.markerHits).toBeGreaterThan(0);
  });

  it('never carries the post author through parsing', () => {
    const [parsed] = parseRedditFeed(feed([entry({ author: 'someone_real' })]), 'smallbusiness');
    expect(JSON.stringify(parsed)).not.toContain('someone_real');
    expect(JSON.stringify(parsed)).not.toContain('/u/');
    expect(Object.keys(parsed ?? {})).not.toContain('author');
  });

  it('redacts handles mentioned inside the post text', () => {
    const [parsed] = parseRedditFeed(
      feed([
        entry({
          title: 'How do I do what u/some_helper suggested?',
          body: `${PROBLEM_BODY} /u/another_person said to try a macro.`,
        }),
      ]),
      'smallbusiness',
    );
    expect(parsed?.title).toContain('[user]');
    expect(parsed?.body).toContain('[user]');
    expect(parsed?.body).not.toContain('another_person');
  });

  it('drops link-only posts, which carry no body before the footer', () => {
    expect(parseRedditFeed(feed([entry({ body: '' })]), 'x')[0]?.body).toBe('');
  });

  it('decodes double-escaped content down to readable text', () => {
    const [parsed] = parseRedditFeed(
      feed([
        entry({ body: 'Sales &amp; VAT reconciliation is tedious &mdash; any way to automate?' }),
      ]),
      'smallbusiness',
    );
    expect(parsed?.body).toContain('Sales & VAT reconciliation');
    expect(parsed?.body).not.toContain('<p>');
    expect(parsed?.body).not.toContain('&lt;');
  });

  it('skips entries missing the fields a candidate needs', () => {
    const broken = '<entry><title>No id or link</title></entry>';
    expect(parseRedditFeed(feed([broken, entry()]), 'x').map((e) => e.id)).toEqual(['abc123']);
    expect(parseRedditFeed('not xml at all', 'x')).toEqual([]);
  });
});

describe('candidateScore', () => {
  it('weighs marker hits above body length', () => {
    expect(candidateScore(2, 100)).toBeGreaterThan(candidateScore(1, 4000));
  });

  it('caps the length contribution so long rants cannot dominate', () => {
    expect(candidateScore(0, 100_000)).toBe(candidateScore(0, 900));
  });
});

describe('isProblemCandidate', () => {
  const base: RedditCandidate = {
    id: 'a',
    subreddit: 'excel',
    title: 't',
    body: 'x'.repeat(200),
    permalink: 'https://www.reddit.com/r/excel/comments/a/',
    createdMs: NOW,
    markerHits: 1,
    score: 12,
  };

  it('requires both a marker hit and a substantial body', () => {
    expect(isProblemCandidate(base, 120)).toBe(true);
    expect(isProblemCandidate({ ...base, markerHits: 0 }, 120)).toBe(false);
    expect(isProblemCandidate({ ...base, body: 'too short' }, 120)).toBe(false);
  });
});

describe('redditProblems', () => {
  it('ranks candidates across subreddits and drops posts outside the window', async () => {
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          okResponse(
            url.includes('/r/excel/')
              ? feed([
                  entry({
                    id: 'busy',
                    subreddit: 'excel',
                    title: 'Is there a way to stop doing this manually? I am struggling',
                    body: `${PROBLEM_BODY} I looked everywhere and I cannot find any tool that fits.`,
                  }),
                ])
              : feed([entry(), entry({ id: 'old', published: hoursAgo(96) })]),
          ),
        ),
      ),
    );

    const result = await redditProblems({ subreddits: ['smallbusiness', 'excel'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const summary = result.points[0];
    expect(summary?.dimensions.metric).toBe('candidates');
    expect(summary?.value).toBe(2);

    const candidates = result.points.filter((p) => p.dimensions.metric === 'candidate');
    expect(candidates.map((p) => p.dimensions.subreddit)).toEqual(['excel', 'smallbusiness']);
    expect(candidates[0]?.dimensions.rank).toBe(1);
  });

  it('reads the Atom feed and accepts subreddits written as r/name', async () => {
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn().mockResolvedValue(okResponse(feed([entry()])));
    vi.stubGlobal('fetch', fetchMock);

    await redditProblems({ subreddits: ['r/smallbusiness'] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://www.reddit.com/r/smallbusiness/new.rss');
  });

  it('sends a descriptive user agent', async () => {
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn().mockResolvedValue(okResponse(feed([])));
    vi.stubGlobal('fetch', fetchMock);

    await redditProblems({ subreddits: ['excel'] });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('antenna');
  });

  it('keeps working when only some subreddits fail', async () => {
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/r/excel/')
            ? new Response('blocked', { status: 403 })
            : okResponse(feed([entry()])),
        ),
      ),
    );

    const result = await redditProblems({ subreddits: ['smallbusiness', 'excel'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.rawPayload as { failures: unknown[] }).failures).toHaveLength(1);
  });

  it('fails when every subreddit is refused', async () => {
    vi.setSystemTime(NOW);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('blocked', { status: 403 })));

    const result = await redditProblems({ subreddits: ['excel'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('403');
  });

  it('surfaces rate limiting with a retry hint', async () => {
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('slow down', { status: 429, headers: { 'retry-after': '120' } }),
        ),
    );

    const result = await redditProblems({ subreddits: ['excel'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('rate_limited');
    expect(result.error.retryAfterSeconds).toBe(120);
  });

  it('reports a network failure rather than throwing', async () => {
    vi.setSystemTime(NOW);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket closed')));

    const result = await redditProblems({ subreddits: ['excel'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('socket closed');
  });
});

describe('rateLimitRetrySeconds', () => {
  it('uses x-ratelimit-reset when Reddit sends no retry-after', () => {
    expect(rateLimitRetrySeconds(new Headers({ 'x-ratelimit-reset': '32' }))).toBe(32);
  });

  it('prefers an explicit retry-after over the reset window', () => {
    expect(
      rateLimitRetrySeconds(new Headers({ 'retry-after': '5', 'x-ratelimit-reset': '32' })),
    ).toBe(5);
  });

  it('falls back to a conservative delay when neither header is usable', () => {
    expect(rateLimitRetrySeconds(new Headers())).toBe(60);
    expect(rateLimitRetrySeconds(new Headers({ 'x-ratelimit-reset': 'soon' }))).toBe(60);
  });
});
