import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { macroMarketHistory } from './macro-market-history';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('macroMarketHistory', () => {
  it('parses Bank of England CSV series rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('DATE,IUDMNPY\n20 May 2025,4.521\n21 May 2025,4.500\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      ),
    );

    const result = await macroMarketHistory({
      kind: 'boe-series',
      series: 'IUDMNPY',
      label: 'UK 10Y gilt',
      unit: '%',
      sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=20%2FMay%2F2025&Dateto=20%2FMay%2F2026',
      ),
      { headers: { accept: 'text/csv' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { symbol: 'IUDMNPY', label: 'UK 10Y gilt' },
        value: 4.521,
        unit: '%',
        ts: Date.UTC(2025, 4, 20),
        sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
      },
      {
        dimensions: { symbol: 'IUDMNPY', label: 'UK 10Y gilt' },
        value: 4.5,
        unit: '%',
        ts: Date.UTC(2025, 4, 21),
        sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
      },
    ]);
  });

  it('parses Frankfurter range rates for a currency pair', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ rates: { '2026-05-19': { USD: 1.3421 } } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await macroMarketHistory({
      kind: 'frankfurter-pair',
      base: 'GBP',
      quote: 'USD',
      label: 'GBP/USD',
      sourceUrl: 'https://frankfurter.dev/',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2025-05-20..2026-05-20?base=GBP&symbols=USD',
      { headers: { accept: 'application/json' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { symbol: 'GBP/USD', label: 'GBP/USD' },
        value: 1.3421,
        unit: 'USD',
        ts: Date.UTC(2026, 4, 19),
        sourceUrl: 'https://frankfurter.dev/',
      },
    ]);
  });

  it('parses FRED graph CSV rows and skips missing values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('observation_date,DCOILWTICO\n2026-05-19,63.97\n2026-05-20,.\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      ),
    );

    const result = await macroMarketHistory({
      kind: 'fred-csv',
      seriesId: 'DCOILWTICO',
      label: 'Crude oil',
      unit: 'USD/BBL',
      sourceUrl: 'https://fred.stlouisfed.org/series/DCOILWTICO',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO&cosd=2025-05-20&coed=2026-05-20',
      { headers: { accept: 'text/csv' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { symbol: 'DCOILWTICO', label: 'Crude oil' },
        value: 63.97,
        unit: 'USD/BBL',
        ts: Date.UTC(2026, 4, 19),
        sourceUrl: 'https://fred.stlouisfed.org/series/DCOILWTICO',
      },
    ]);
  });

  it('parses EIA petroleum daily HTML rows and skips blanks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          `
            <table>
              <tr>
                <td class='B6'>&nbsp;&nbsp;2026 Jan- 5 to Jan- 9</td>
                <td class='B3'>58.10</td>
                <td class='B3'></td>
                <td class='B3'>56.01</td>
                <td class='B3'>57.74</td>
                <td class='B3'>58.96</td>
              </tr>
            </table>
          `,
          { status: 200, headers: { 'content-type': 'text/html' } },
        ),
      ),
    );

    const result = await macroMarketHistory({
      kind: 'eia-petroleum-html',
      symbol: 'RWTC',
      label: 'Crude oil',
      unit: 'USD/BBL',
      sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
      days: 365,
    });

    expect(fetch).toHaveBeenCalledWith('https://www.eia.gov/dnav/pet/hist/RWTCd.htm', {
      headers: { accept: 'text/html' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { symbol: 'RWTC', label: 'Crude oil' },
        value: 58.1,
        unit: 'USD/BBL',
        ts: Date.UTC(2026, 0, 5),
        sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
      },
      {
        dimensions: { symbol: 'RWTC', label: 'Crude oil' },
        value: 56.01,
        unit: 'USD/BBL',
        ts: Date.UTC(2026, 0, 7),
        sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
      },
      {
        dimensions: { symbol: 'RWTC', label: 'Crude oil' },
        value: 57.74,
        unit: 'USD/BBL',
        ts: Date.UTC(2026, 0, 8),
        sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
      },
      {
        dimensions: { symbol: 'RWTC', label: 'Crude oil' },
        value: 58.96,
        unit: 'USD/BBL',
        ts: Date.UTC(2026, 0, 9),
        sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
      },
    ]);
  });

  it('uses Yahoo history for symbols without a free official history API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { symbol: 'GC=F', currency: 'USD' },
                  timestamp: [1_700_000_000],
                  indicators: { quote: [{ close: [2025.5] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await macroMarketHistory({
      kind: 'yahoo-symbol',
      symbol: 'GC=F',
      label: 'Gold',
      sourceUrl: 'https://finance.yahoo.com/quote/GC=F/',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1y&interval=1d',
      expect.any(Object),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]).toEqual({
      dimensions: { symbol: 'GC=F', label: 'Gold' },
      value: 2025.5,
      unit: 'USD',
      ts: 1_700_000_000_000,
      sourceUrl: 'https://finance.yahoo.com/quote/GC=F/',
    });
  });
});
