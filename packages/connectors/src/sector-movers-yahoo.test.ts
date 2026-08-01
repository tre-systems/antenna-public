import { afterEach, describe, expect, it, vi } from 'vitest';
import { sectorMoversYahoo } from './sector-movers-yahoo';

afterEach(() => {
  vi.unstubAllGlobals();
});

const yahooResponse = (
  symbol: string,
  previousClose: number,
  regularMarketPrice: number,
  regularMarketTime = 1_700_000_000,
): Response =>
  new Response(
    JSON.stringify({
      chart: {
        result: [
          {
            meta: {
              symbol,
              currency: 'USD',
              chartPreviousClose: previousClose,
              regularMarketPrice,
              regularMarketTime,
            },
          },
        ],
        error: null,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const FAKE_QUOTES: Record<string, { prev: number; current: number }> = {
  XLK: { prev: 200, current: 202 }, // +1.00%
  XLC: { prev: 80, current: 80.4 }, // +0.50%
  XLY: { prev: 180, current: 178.2 }, // -1.00%
  XLP: { prev: 75, current: 75 }, // 0.00%
  XLE: { prev: 90, current: 89.1 }, // -1.00%
  XLF: { prev: 40, current: 40.4 }, // +1.00%
  XLV: { prev: 130, current: 132.6 }, // +2.00%
  XLI: { prev: 110, current: 109.45 }, // -0.50%
  XLB: { prev: 85, current: 84.575 }, // -0.50%
  XLRE: { prev: 42, current: 41.79 }, // -0.50%
  XLU: { prev: 70, current: 70.35 }, // +0.50%
};

const mockYahoo = () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const match = /\/chart\/([A-Z]+)\?/.exec(url);
      const symbol = match?.[1] ?? '';
      const q = FAKE_QUOTES[symbol];
      if (!q) return Promise.resolve(new Response('not found', { status: 404 }));
      return Promise.resolve(yahooResponse(symbol, q.prev, q.current));
    }),
  );
};

describe('sectorMoversYahoo', () => {
  it('returns one ranked point per sector ETF, sorted by % change descending', async () => {
    mockYahoo();

    const result = await sectorMoversYahoo({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(11);

    const first = result.points[0];
    expect(first?.dimensions.ticker).toBe('XLV');
    expect(first?.dimensions.sector).toBe('Health Care');
    expect(first?.dimensions.metric).toBe('sector_change');
    expect(first?.dimensions.rank).toBe(1);
    expect(first?.value).toBe(2);
    expect(first?.unit).toBe('%');
    expect(first?.sourceUrl).toBe('https://finance.yahoo.com/quote/XLV/');

    const ranks = result.points.map((p) => p.dimensions.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const changes = result.points.map((p) => p.value);
    for (let i = 1; i < changes.length; i++) {
      expect(Number(changes[i - 1])).toBeGreaterThanOrEqual(Number(changes[i]));
    }

    const last = result.points[result.points.length - 1];
    expect(['XLY', 'XLE']).toContain(last?.dimensions.ticker);
    expect(last?.value).toBe(-1);
  });

  it('attaches current price + currency in dimensions for the compact-rows hero', async () => {
    mockYahoo();

    const result = await sectorMoversYahoo({});
    if (!result.ok) throw new Error('expected ok');

    const xlk = result.points.find((p) => p.dimensions.ticker === 'XLK');
    expect(xlk?.dimensions.current_price).toBe(202);
    expect(xlk?.dimensions.currency).toBe('USD');
    expect(xlk?.value).toBe(1);
  });

  // Distinct labels prevent separate ETFs from rendering as duplicate compact rows.
  it('emits one row per ETF with distinct sector labels and tickers', async () => {
    mockYahoo();

    const result = await sectorMoversYahoo({});
    if (!result.ok) throw new Error('expected ok');

    const sectors = result.points.map((p) => p.dimensions.sector);
    const tickers = result.points.map((p) => p.dimensions.ticker);
    expect(new Set(sectors).size).toBe(result.points.length);
    expect(new Set(tickers).size).toBe(result.points.length);
  });

  it('fails the whole tick when any ETF response is missing meta fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/XLK?')) {
          return Promise.resolve(
            new Response(JSON.stringify({ chart: { result: [{ meta: {} }] } }), { status: 200 }),
          );
        }
        return Promise.resolve(yahooResponse('OTHER', 100, 101));
      }),
    );

    const result = await sectorMoversYahoo({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
    expect(result.error.message).toContain('XLK');
  });

  it('fails when a non-2xx response comes back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/XLF?')) {
          return Promise.resolve(new Response('rate limited', { status: 429 }));
        }
        return Promise.resolve(yahooResponse('OTHER', 100, 101));
      }),
    );

    const result = await sectorMoversYahoo({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('XLF');
    expect(result.error.message).toContain('429');
  });
});
