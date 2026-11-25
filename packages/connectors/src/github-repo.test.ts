import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubRepo } from './github-repo';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('githubRepo', () => {
  it.each([
    { private: true, visibility: 'private' },
    { private: false, visibility: 'internal' },
    {},
    { private: 'false', visibility: 'public' },
  ])('rejects private or unverified repository visibility: %j', async (visibility) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...visibility, stargazers_count: 999 })),
    );
    const result = await githubRepo({
      owner: 'example',
      repo: 'private',
      githubToken: 'server-token',
    });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('rawPayload');
    expect(JSON.stringify(result)).not.toContain('999');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });
  it('returns stars/issues/forks points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          private: false,
          visibility: 'public',
          stargazers_count: 1234,
          open_issues_count: 12,
          forks_count: 56,
        }),
      ),
    );

    const result = await githubRepo({ owner: 'example', repo: 'collection' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points.map((p) => p.dimensions.metric)).toEqual([
      'stars',
      'open_issues',
      'forks',
    ]);
    expect(result.points.every((p) => p.dimensions.repo === 'example/collection')).toBe(true);
    expect(result.points[0]?.value).toBe(1234);
  });

  it('maps 403 to rate_limited with retryAfter', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('rl', { status: 403, headers: { 'retry-after': '120' } })),
    );
    const result = await githubRepo({ owner: 'example', repo: 'collection' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('rate_limited');
    expect(result.error.retryAfterSeconds).toBe(120);
  });

  it('maps other non-2xx to fetch_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    const result = await githubRepo({ owner: 'x', repo: 'y' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
  });

  it('rejects redirects without forwarding deployment credentials to the destination', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://unapproved.test/repo' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await githubRepo({
      owner: 'example',
      repo: 'public',
      githubToken: 'test-token',
    });
    expect(result).toEqual({ ok: false, error: { code: 'fetch_failed', message: 'HTTP 302' } });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://api.github.com/repos/example/public',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('maps malformed JSON to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('xxx', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    );
    const result = await githubRepo({ owner: 'x', repo: 'y' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('sends User-Agent and Accept headers', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        private: false,
        visibility: 'public',
        stargazers_count: 1,
        open_issues_count: 0,
        forks_count: 0,
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await githubRepo({ owner: 'example', repo: 'collection' });
    const call = fetchSpy.mock.calls[0];
    const init = call?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['User-Agent']).toBe('antenna');
    expect(headers?.Accept).toBe('application/vnd.github+json');
  });

  it('sends bearer auth when a GitHub token is configured', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        private: false,
        visibility: 'public',
        stargazers_count: 1,
        open_issues_count: 0,
        forks_count: 0,
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await githubRepo({ owner: 'example', repo: 'collection', githubToken: 'ghp_test' });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer ghp_test');
  });
});
