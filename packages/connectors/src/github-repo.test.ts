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
  it('returns stars/issues/forks points', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ stargazers_count: 1234, open_issues_count: 12, forks_count: 56 }),
        ),
    );

    const result = await githubRepo({ owner: 'example-org', repo: 'collection' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points.map((p) => p.dimensions.metric)).toEqual([
      'stars',
      'open_issues',
      'forks',
    ]);
    expect(result.points.every((p) => p.dimensions.repo === 'example-org/collection')).toBe(true);
    expect(result.points[0]?.value).toBe(1234);
  });

  it('maps 403 to rate_limited with retryAfter', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('rl', { status: 403, headers: { 'retry-after': '120' } })),
    );
    const result = await githubRepo({ owner: 'example-org', repo: 'collection' });
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
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ stargazers_count: 1, open_issues_count: 0, forks_count: 0 }),
      );
    vi.stubGlobal('fetch', fetchSpy);
    await githubRepo({ owner: 'example-org', repo: 'collection' });
    const call = fetchSpy.mock.calls[0];
    const init = call?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['User-Agent']).toBe('antenna');
    expect(headers?.Accept).toBe('application/vnd.github+json');
  });

  it('sends bearer auth when a GitHub token is configured', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ stargazers_count: 1, open_issues_count: 0, forks_count: 0 }),
      );
    vi.stubGlobal('fetch', fetchSpy);

    await githubRepo({
      owner: 'example-org',
      repo: 'collection',
      githubToken: 'test-github-token',
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer test-github-token');
  });
});
