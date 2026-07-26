import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubTrending, parseGithubTrending } from './github-trending';

const html = `
  <article class="Box-row">
    <h2 class="h3 lh-condensed">
      <a href="/owner-one/repo-one" class="Link">
        owner-one / repo-one
      </a>
    </h2>
    <p class="col-9 color-fg-muted my-1">
      First useful repo.
    </p>
    <span itemprop="programmingLanguage">TypeScript</span>
    <a class="Link Link--muted d-inline-block" href="/owner-one/repo-one/stargazers">1,234</a>
    <a class="Link Link--muted d-inline-block" href="/owner-one/repo-one/forks">56</a>
    <span class="d-inline-block float-sm-right">789 stars today</span>
  </article>
  <article class="Box-row">
    <h2 class="h3 lh-condensed">
      <a href="/owner-two/repo-two" class="Link">owner-two / repo-two</a>
    </h2>
    <span itemprop="programmingLanguage">Python</span>
    <span class="d-inline-block float-sm-right">42 stars today</span>
  </article>
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseGithubTrending', () => {
  it('extracts ranked repository rows from GitHub Trending HTML', () => {
    expect(parseGithubTrending(html)).toEqual([
      {
        rank: 1,
        repo: 'owner-one/repo-one',
        description: 'First useful repo.',
        language: 'TypeScript',
        stars: 1234,
        forks: 56,
        starsToday: 789,
        url: 'https://github.com/owner-one/repo-one',
      },
      {
        rank: 2,
        repo: 'owner-two/repo-two',
        language: 'Python',
        starsToday: 42,
        url: 'https://github.com/owner-two/repo-two',
      },
    ]);
  });

  it('ignores rows whose heading link is not a plain owner/repo path', () => {
    const malformed = `
      <article class="Box-row">
        <h2><a href="/owner/repo/extra">owner / repo / extra</a></h2>
      </article>
      <article class="Box-row">
        <h2><a href="https://elsewhere.test/owner/repo">owner / repo</a></h2>
      </article>
    `;

    expect(parseGithubTrending(malformed)).toEqual([]);
  });

  it('decodes description entities exactly once', () => {
    const [first] = parseGithubTrending(`
      <article class="Box-row">
        <h2><a href="/owner/repo">owner / repo</a></h2>
        <p class="color-fg-muted">Tools &amp;amp; toys for &lt;everyone&gt;</p>
      </article>
    `);

    expect(first?.description).toBe('Tools &amp; toys for <everyone>');
  });
});

describe('githubTrending', () => {
  it('returns stable rank-slot text points', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
        ),
    );

    const result = await githubTrending({ limit: 2 });

    expect(fetch).toHaveBeenCalledWith('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent': 'antenna',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.dimensions)).toEqual([
      { source: 'github-trending', rank: 1 },
      { source: 'github-trending', rank: 2 },
    ]);
    expect(result.points[0]?.value).toBe('owner-one/repo-one · TypeScript · +789 stars today');
    // Points carry no sourceUrl; the registry derives the per-repo URL from the
    // value text so the signal-level source stays the trending list.
    expect(result.points[0]?.sourceUrl).toBeUndefined();
    expect(result.rawPayload).toMatchObject({
      since: 'daily',
      repos: [{ repo: 'owner-one/repo-one' }, { repo: 'owner-two/repo-two' }],
    });
  });

  it('maps rate limits and empty pages to clear errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('rl', { status: 429, headers: { 'retry-after': '75' } })),
    );
    const limited = await githubTrending({});
    expect(limited.ok).toBe(false);
    if (limited.ok) return;
    expect(limited.error.code).toBe('rate_limited');
    expect(limited.error.retryAfterSeconds).toBe(75);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<main></main>', { status: 200 })),
    );
    const empty = await githubTrending({});
    expect(empty).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'no trending repos parsed' },
    });
  });

  it('sends bearer auth when a GitHub token is configured', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await githubTrending({ limit: 1, githubToken: 'ghp_test' });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer ghp_test');
  });
});
