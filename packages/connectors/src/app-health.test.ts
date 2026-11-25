import { afterEach, describe, expect, it, vi } from 'vitest';
import { appHealth } from './app-health';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('appHealth', () => {
  it('retains real HTTP failures alongside unavailable probes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('ok'))
      .mockResolvedValueOnce(new Response('no', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await appHealth({
      projects: 'healthy-app,down-app,missing',
      manifest: JSON.stringify({
        'healthy-app': 'https://healthy.example/health',
        'down-app': 'https://down.example/health',
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toMatchObject([
      { dimensions: { project: 'healthy-app', state: 'healthy', http_status: 200 }, value: 1 },
      { dimensions: { project: 'down-app', state: 'down', http_status: 503 }, value: 0 },
      { dimensions: { project: 'missing', state: 'unconfigured' }, value: 'unknown' },
    ]);
    expect(result.warning).toMatchObject({ code: 'fetch_failed' });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://healthy.example/health',
      'https://down.example/health',
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it.each([200, 404, 500, 503])(
    'treats HTTP %i as an observed application response',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
      const result = await appHealth({
        projects: 'app',
        manifest: '{"app":"https://example.test/health"}',
      });
      expect(result).toMatchObject({
        ok: true,
        points: [
          {
            dimensions: { state: status === 200 ? 'healthy' : 'down', http_status: status },
            value: status === 200 ? 1 : 0,
          },
        ],
      });
      expect(result).not.toHaveProperty('warning');
    },
  );

  it.each([
    new TypeError('private source URL and credentials'),
    new DOMException('private source URL', 'TimeoutError'),
    new DOMException('private source URL', 'AbortError'),
  ])('reports a sanitized unknown result on probe failure: $name', async (error) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    const result = await appHealth({
      projects: 'app',
      manifest: '{"app":"https://example.test/health"}',
    });
    expect(result).toMatchObject({
      ok: true,
      points: [{ dimensions: { state: 'probe_error', http_status: 0 }, value: 'unknown' }],
      warning: { code: 'fetch_failed' },
    });
    expect(JSON.stringify(result)).not.toContain('private source');
  });

  it.each([301, 302, 307, 308])(
    'does not follow HTTP %i redirects or infer destination health',
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(null, {
          status,
          headers: { Location: 'https://unapproved.test/private' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const result = await appHealth({
        projects: 'app',
        manifest: '{"app":"https://example.test/health"}',
      });
      expect(result).toMatchObject({
        ok: true,
        points: [{ dimensions: { state: 'redirect', http_status: status }, value: 'unknown' }],
        warning: { code: 'fetch_failed' },
      });
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        'https://example.test/health',
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(JSON.stringify(result)).not.toContain('unapproved');
    },
  );

  it('distinguishes a slow successful response from downtime and cancels its body', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        vi.setSystemTime(3100);
        return Promise.resolve(new Response(new ReadableStream({ cancel })));
      }),
    );
    const result = await appHealth({
      projects: 'app',
      manifest: '{"app":"https://example.test/health"}',
    });
    expect(result).toMatchObject({
      ok: true,
      points: [{ dimensions: { state: 'degraded', latency_ms: 2100 }, value: 1 }],
    });
    expect(result).not.toHaveProperty('warning');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects unsafe manifests before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await appHealth({
      projects: 'safe',
      manifest: '{"safe":"http://127.0.0.1/private"}',
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid health manifest' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
