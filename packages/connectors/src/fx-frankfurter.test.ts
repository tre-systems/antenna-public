import { afterEach, describe, expect, it, vi } from 'vitest';
import { fxFrankfurter } from './fx-frankfurter';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fxFrankfurter', () => {
  it('returns one DataPoint per business day in the historical range', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          amount: 1,
          base: 'EUR',
          start_date: '2026-05-15',
          end_date: '2026-05-20',
          rates: {
            '2026-05-15': { USD: 1.08 },
            '2026-05-18': { USD: 1.082 },
            '2026-05-19': { USD: 1.0823 },
            '2026-05-20': { USD: 1.085 },
          },
        }),
      ),
    );

    const result = await fxFrankfurter({ base: 'EUR', quote: 'USD' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(4);
    expect(result.points.every((p) => p.dimensions.pair === 'EUR/USD')).toBe(true);
    expect(result.points.every((p) => p.unit === 'USD')).toBe(true);
    expect(new Set(result.points.map((p) => p.value))).toEqual(
      new Set([1.08, 1.082, 1.0823, 1.085]),
    );
    // Source dates prevent a full range from collapsing onto one sparkline column.
    const tsByDate = new Map(result.points.map((p) => [p.value, p.ts] as const));
    expect(tsByDate.get(1.08)).toBe(Date.parse('2026-05-15'));
    expect(tsByDate.get(1.085)).toBe(Date.parse('2026-05-20'));
  });

  it('requests a year-long range against api.frankfurter.dev', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        amount: 1,
        base: 'EUR',
        start_date: '2025-05-21',
        end_date: '2026-05-21',
        rates: { '2026-05-21': { USD: 1.09 } },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await fxFrankfurter({ base: 'EUR', quote: 'USD' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url.startsWith('https://api.frankfurter.dev/v1/')).toBe(true);
    expect(url).toMatch(/\/v1\/\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}\?from=EUR&to=USD$/);
    const [, range] = /\/v1\/(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})\?/.exec(url) ?? [];
    if (!range) throw new Error('expected start_date in URL');
    const [start, end] = url.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    if (!start || !end) throw new Error('expected start and end dates');
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(364);
    expect(days).toBeLessThanOrEqual(366);
  });

  it('falls back to the legacy single-date /latest shape if returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          amount: 1,
          base: 'EUR',
          date: '2026-05-19',
          rates: { USD: 1.0823 },
        }),
      ),
    );

    const result = await fxFrankfurter({ base: 'EUR', quote: 'USD' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    const [point] = result.points;
    if (!point) throw new Error('expected a point');
    expect(point.dimensions).toEqual({ pair: 'EUR/USD' });
    expect(point.value).toBe(1.0823);
    expect(point.unit).toBe('USD');
    expect(point.ts).toBe(Date.parse('2026-05-19'));
  });

  it('maps non-2xx to fetch_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('nope', { status: 500 }))
        .mockResolvedValueOnce(new Response('nope again', { status: 502 })),
    );

    const result = await fxFrankfurter({ base: 'EUR', quote: 'USD' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('502');
  });

  it('falls back to latest when the historical range endpoint fails', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('cloudflare origin down', { status: 521 }))
      .mockResolvedValueOnce(
        jsonResponse({
          amount: 1,
          base: 'AUD',
          date: '2026-05-22',
          rates: { USD: 0.71209 },
        }),
      );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fxFrankfurter({ base: 'AUD', quote: 'USD' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      'https://api.frankfurter.dev/v1/latest?base=AUD&symbols=USD',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { pair: 'AUD/USD' },
        value: 0.71209,
        unit: 'USD',
        ts: Date.parse('2026-05-22'),
      },
    ]);
  });

  it('maps malformed JSON to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await fxFrankfurter({ base: 'EUR', quote: 'USD' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('maps thrown fetch (network error) to fetch_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('still down')),
    );

    const result = await fxFrankfurter({ base: 'EUR', quote: 'USD' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toBe('still down');
  });
});
