import { afterEach, describe, expect, it, vi } from 'vitest';
import { appHealth } from './app-health';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('appHealth', () => {
  it('probes only server-manifest URLs and reports failures without failing the observation', async () => {
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
      { dimensions: { project: 'missing', state: 'unconfigured' }, value: 0 },
    ]);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://healthy.example/health',
      'https://down.example/health',
    ]);
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
