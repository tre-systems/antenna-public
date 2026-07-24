import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchYahooLatestQuote,
  YAHOO_CHART_REQUEST_INIT,
  yahooChartUrl,
  yahooSymbolForStooqTicker,
} from './yahoo-quote';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchYahooLatestQuote', () => {
  it('returns the latest quote from Yahoo chart metadata', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  symbol: 'VTI',
                  currency: 'USD',
                  chartPreviousClose: 360,
                  regularMarketPrice: 366.79,
                  regularMarketTime: 1_700_000_000,
                },
              },
            ],
            error: null,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchYahooLatestQuote('VTI');

    expect(fetchSpy).toHaveBeenCalledWith(yahooChartUrl('VTI'), YAHOO_CHART_REQUEST_INIT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote).toMatchObject({
      requestedSymbol: 'VTI',
      symbol: 'VTI',
      price: 366.79,
      previousClose: 360,
      ts: 1_700_000_000_000,
      currency: 'USD',
      sourceUrl: 'https://finance.yahoo.com/quote/VTI/',
    });
    expect(result.quote.changePct).toBeCloseTo(1.8861, 4);
    expect(result.rawPayload).toEqual(expect.any(Object));
  });

  it('falls back to the latest two close prices when metadata is incomplete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { symbol: 'AZN.L', currency: 'GBp' },
                  timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
                  indicators: { quote: [{ close: [100, null, 103] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await fetchYahooLatestQuote('AZN.L');

    expect(result).toMatchObject({
      ok: true,
      quote: {
        requestedSymbol: 'AZN.L',
        symbol: 'AZN.L',
        price: 103,
        previousClose: 100,
        changePct: 3,
        ts: 1_700_172_800_000,
        currency: 'GBp',
        sourceUrl: 'https://finance.yahoo.com/quote/AZN.L/',
      },
    });
  });

  it('ignores zero close placeholders when falling back to chart prices', async () => {
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
                  indicators: { quote: [{ close: [4.5, 0, 4.75] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await fetchYahooLatestQuote('FUND.L');

    expect(result).toMatchObject({
      ok: true,
      quote: {
        price: 4.75,
        previousClose: 4.5,
      },
    });
  });

  it('falls back when Yahoo metadata contains a zero placeholder price', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'FUND.L',
                    currency: 'GBP',
                    chartPreviousClose: 4.5,
                    regularMarketPrice: 0,
                    regularMarketTime: 1_700_172_800,
                  },
                  timestamp: [1_700_000_000, 1_700_172_800],
                  indicators: { quote: [{ close: [4.5, 4.75] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await fetchYahooLatestQuote('FUND.L');

    expect(result).toMatchObject({
      ok: true,
      quote: {
        price: 4.75,
        previousClose: 4.5,
      },
    });
  });

  it('maps common Stooq suffixes to Yahoo symbols', () => {
    expect(yahooSymbolForStooqTicker('VTI.US')).toBe('VTI');
    expect(yahooSymbolForStooqTicker('AZN.UK')).toBe('AZN.L');
    expect(yahooSymbolForStooqTicker('SHEL.L')).toBe('SHEL.L');
  });
});
