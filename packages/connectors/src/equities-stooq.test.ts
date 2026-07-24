import { afterEach, describe, expect, it, vi } from 'vitest';
import { equitiesStooq } from './equities-stooq';
import { STOOQ_CSV_REQUEST_INIT } from './stooq';

const textResponse = (body: string, init?: ResponseInit): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/csv' }, ...init });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('equitiesStooq', () => {
  it('parses a CSV with two tickers', async () => {
    const aapl = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'AAPL.US,2026-05-19,21:00:00,180.0,182.5,179.5,181.2,12345678',
    ].join('\n');
    const msft = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'MSFT.US,2026-05-19,21:00:00,420.0,425.0,419.0,424.1,9876543',
    ].join('\n');
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(textResponse(aapl))
      .mockResolvedValueOnce(textResponse(msft));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await equitiesStooq({ tickers: ['AAPL.US', 'MSFT.US'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(2);
    expect(result.points[0]?.value).toBe(181.2);
    expect(result.points[0]?.dimensions).toEqual({ ticker: 'AAPL.US', exchange: 'STOOQ' });
    expect(result.points[1]?.value).toBe(424.1);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://stooq.com/q/l/?s=AAPL.US&f=sd2t2ohlcv&h&e=csv',
      STOOQ_CSV_REQUEST_INIT,
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://stooq.com/q/l/?s=MSFT.US&f=sd2t2ohlcv&h&e=csv',
      STOOQ_CSV_REQUEST_INIT,
    );
  });

  it('skips rows where Close is N/D', async () => {
    const aapl = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'AAPL.US,2026-05-19,21:00:00,180,182,179,181,1',
    ].join('\n');
    const missing = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'ZZZZ.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(textResponse(aapl))
        .mockResolvedValueOnce(textResponse(missing))
        .mockResolvedValueOnce(new Response('not found', { status: 404 })),
    );

    const result = await equitiesStooq({ tickers: ['AAPL.US', 'ZZZZ.US'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
  });

  it('keeps successful ticker points when another ticker fetch fails', async () => {
    const aapl = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'AAPL.US,2026-05-19,21:00:00,180,182,179,181,1',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(textResponse(aapl))
        .mockResolvedValueOnce(new Response('temporary outage', { status: 522 }))
        .mockResolvedValueOnce(new Response('temporary outage', { status: 522 }))
        .mockResolvedValueOnce(new Response('not found', { status: 404 })),
    );

    const result = await equitiesStooq({ tickers: ['AAPL.US', 'MSFT.US'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.dimensions).toEqual({ ticker: 'AAPL.US', exchange: 'STOOQ' });
    expect(result.rawPayload).toContain(
      'MSFT.US: fetch_failed: stooq.com: HTTP 522; stooq.pl: HTTP 522',
    );
  });

  it('falls back to Yahoo when Stooq returns a non-quote row', async () => {
    const missing = [
      'Symbol,Date,Time,Open,High,Low,Close,Volume',
      'AZN.UK,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(textResponse(missing))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              chart: {
                result: [
                  {
                    meta: {
                      symbol: 'AZN.L',
                      currency: 'GBp',
                      chartPreviousClose: 1961,
                      regularMarketPrice: 1995,
                      regularMarketTime: 1_700_000_000,
                    },
                  },
                ],
                error: null,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    );

    const result = await equitiesStooq({ tickers: ['AZN.UK'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { ticker: 'AZN.L', exchange: 'YAHOO' },
        value: 1995,
        unit: 'GBp',
        ts: 1_700_000_000_000,
        sourceUrl: 'https://finance.yahoo.com/quote/AZN.L/',
      },
    ]);
    expect(result.rawPayload).toContain('AZN.UK: stooq parse_failed: no rows parsed; used yahoo');
  });

  it('maps non-2xx to fetch_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })));
    const result = await equitiesStooq({ tickers: ['AAPL.US'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('AAPL.US');
  });

  it('returns parse_failed on empty CSV', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(textResponse('Symbol,Date,Time,Open,High,Low,Close,Volume\n'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ chart: { result: [], error: null } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    );
    const result = await equitiesStooq({ tickers: ['AAPL.US'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('rejects empty ticker list without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await equitiesStooq({ tickers: [] });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
