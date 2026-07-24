import { afterEach, describe, expect, it, vi } from 'vitest';
import { yahooMarketHistory } from './market-yahoo';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('yahooMarketHistory', () => {
  it('returns daily close points from Yahoo chart JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { symbol: 'AZN.L', currency: 'GBp', shortName: 'AstraZeneca' },
                  timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
                  indicators: { quote: [{ close: [100.1, null, 103.5] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await yahooMarketHistory({ symbol: 'AZN.L' });

    expect(fetch).toHaveBeenCalledWith(
      'https://query1.finance.yahoo.com/v8/finance/chart/AZN.L?range=1y&interval=1d',
      {
        headers: {
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { ticker: 'AZN.L' },
        value: 100.1,
        unit: 'GBp',
        ts: 1_700_000_000_000,
        sourceUrl: 'https://finance.yahoo.com/quote/AZN.L/',
      },
      {
        dimensions: { ticker: 'AZN.L' },
        value: 103.5,
        unit: 'GBp',
        ts: 1_700_172_800_000,
        sourceUrl: 'https://finance.yahoo.com/quote/AZN.L/',
      },
    ]);
  });

  it('fails clearly when no close prices can be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ chart: { result: [], error: null } }), { status: 200 }),
        ),
    );

    const result = await yahooMarketHistory({ symbol: 'MISSING.L' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'no close prices parsed' },
    });
  });

  it('ignores non-positive placeholder close prices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { symbol: 'FUND.L', currency: 'GBP' },
                  timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
                  indicators: { quote: [{ close: [4.5, 0, 4.7] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await yahooMarketHistory({ symbol: 'FUND.L' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.value)).toEqual([4.5, 4.7]);
  });
});
