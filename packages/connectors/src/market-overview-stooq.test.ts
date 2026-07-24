import { afterEach, describe, expect, it, vi } from 'vitest';
import { marketOverviewStooq } from './market-overview-stooq';
import { STOOQ_CSV_REQUEST_INIT } from './stooq';

afterEach(() => {
  vi.unstubAllGlobals();
});

const csv = (symbol: string, open: number, close: number): Response =>
  new Response(
    [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      `${symbol},2026-05-21,21:00:00,${String(open)},${String(Math.max(open, close))},${String(Math.min(open, close))},${String(close)},1000`,
    ].join('\n'),
    { status: 200, headers: { 'content-type': 'text/csv' } },
  );

const mockQuotes = (quotes: Readonly<Record<string, readonly [number, number]>>) => {
  const fetchSpy = vi.fn().mockImplementation((url: string) => {
    const symbol = /s=([^&]+)/.exec(url)?.[1] ?? '';
    const decoded = decodeURIComponent(symbol).toUpperCase();
    const quote = quotes[decoded];
    if (!quote) return Promise.resolve(new Response('not found', { status: 404 }));
    return Promise.resolve(csv(decoded, quote[0], quote[1]));
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
};

describe('marketOverviewStooq', () => {
  it('emits a market regime plus one proxy change per source ticker', async () => {
    const fetchSpy = mockQuotes({
      'VTI.US': [100, 102],
      'QQQ.US': [100, 103],
      'IWM.US': [100, 101],
      'TLT.US': [100, 98],
      'GLD.US': [100, 99],
      'USO.US': [100, 101],
      'UUP.US': [100, 99],
    });

    const result = await marketOverviewStooq({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(8);
    expect(result.points[0]).toMatchObject({
      dimensions: { metric: 'market_regime', positive_count: 4, negative_count: 3 },
      value: 'Risk-on',
      sourceUrl: 'https://stooq.com/',
    });
    const vti = result.points.find((point) => point.dimensions.ticker === 'VTI.US');
    expect(vti).toMatchObject({
      dimensions: { metric: 'market_proxy_change', label: 'US equities', role: 'equity' },
      value: 2,
      unit: '%',
      sourceUrl: 'https://stooq.com/q/?s=vti.us',
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://stooq.com/q/l/?s=VTI.US&f=sd2t2ohlcv&h&e=csv',
      STOOQ_CSV_REQUEST_INIT,
    );
  });

  it('classifies broad weakness as risk-off', async () => {
    mockQuotes({
      'VTI.US': [100, 98],
      'QQQ.US': [100, 98],
      'IWM.US': [100, 97],
      'TLT.US': [100, 102],
      'GLD.US': [100, 102],
      'USO.US': [100, 99],
      'UUP.US': [100, 101],
    });

    const result = await marketOverviewStooq({});
    if (!result.ok) throw new Error('expected ok');
    expect(result.points[0]?.value).toBe('Risk-off');
  });

  it('keeps a market overview when one proxy fetch fails', async () => {
    mockQuotes({
      'QQQ.US': [100, 103],
      'IWM.US': [100, 101],
      'TLT.US': [100, 98],
      'GLD.US': [100, 99],
      'USO.US': [100, 101],
      'UUP.US': [100, 99],
    });

    const result = await marketOverviewStooq({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(7);
    expect(result.points.some((point) => point.dimensions.ticker === 'VTI.US')).toBe(false);
    expect(result.rawPayload).toMatchObject({
      failures: [
        'VTI.US: fetch_failed: stooq.com: HTTP 404; stooq.pl: HTTP 404; yahoo fetch_failed: HTTP 404',
      ],
    });
  });

  it('falls back to Yahoo for a proxy when Stooq returns no quote', async () => {
    const quotes: Record<string, readonly [number, number]> = {
      'QQQ.US': [100, 103],
      'IWM.US': [100, 101],
      'TLT.US': [100, 98],
      'GLD.US': [100, 99],
      'USO.US': [100, 101],
      'UUP.US': [100, 99],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('query1.finance.yahoo.com')) {
          return Promise.resolve(
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
        }

        const symbol = /s=([^&]+)/.exec(url)?.[1] ?? '';
        const decoded = decodeURIComponent(symbol).toUpperCase();
        if (decoded === 'VTI.US') {
          return Promise.resolve(
            new Response(
              'Symbol,Date,Time,Open,High,Low,Close,Volume\nVTI.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
              { status: 200, headers: { 'content-type': 'text/csv' } },
            ),
          );
        }

        const quote = quotes[decoded];
        if (!quote) return Promise.resolve(new Response('not found', { status: 404 }));
        return Promise.resolve(csv(decoded, quote[0], quote[1]));
      }),
    );

    const result = await marketOverviewStooq({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const vti = result.points.find((point) => point.dimensions.ticker === 'VTI.US');
    expect(vti).toMatchObject({
      value: 1.89,
      sourceUrl: 'https://finance.yahoo.com/quote/VTI/',
    });
    expect(result.points[0]?.sourceUrl).toBe('https://finance.yahoo.com/');
    expect(result.rawPayload).toMatchObject({
      failures: ['VTI.US: stooq parse_failed: no quote; used yahoo'],
    });
  });

  it('maps missing CSV data to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response('Symbol,Date,Time,Open,High,Low,Close,Volume\n')),
        ),
    );

    const result = await marketOverviewStooq({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('maps non-2xx responses to fetch_failed with the ticker name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 })),
    );

    const result = await marketOverviewStooq({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('VTI.US');
  });
});
