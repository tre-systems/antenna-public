import { afterEach, describe, expect, it, vi } from 'vitest';
import { cryptoCoinbaseCandles } from './crypto-coinbase-candles';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cryptoCoinbaseCandles', () => {
  it('fetches daily candles in chunks and returns close points', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              [1_700_172_800, 98, 104, 99, 103.5, 11],
              [1_700_086_400, 97, 102, 98, 100.1, 10],
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([[1_700_000_000, 96, 101, 97, 99.9, 9]]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    );

    const result = await cryptoCoinbaseCandles({ pairs: ['BTC-USD'], days: 301 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain(
      'https://api.exchange.coinbase.com/products/BTC-USD/candles?',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toContainEqual({
      dimensions: { pair: 'BTC-USD' },
      value: 103.5,
      unit: 'USD',
      ts: 1_700_172_800_000,
      sourceUrl: 'https://www.coinbase.com/price/btc',
    });
    expect(result.points).toHaveLength(3);
  });

  it('keeps successful pairs when another pair fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify([[1_700_172_800, 98, 104, 99, 103.5, 11]]), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(new Response('nope', { status: 500 }))
        .mockResolvedValueOnce(new Response('still nope', { status: 404 })),
    );

    const result = await cryptoCoinbaseCandles({ pairs: ['BTC-USD', 'NOPE-USD'], days: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    expect(result.rawPayload).toMatchObject({
      perPair: { 'NOPE-USD': { error: { code: 'fetch_failed', message: 'HTTP 500' } } },
    });
  });

  it('falls back to Coinbase historic prices when Exchange candles fail', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                base: 'BTC',
                currency: 'USD',
                prices: [
                  { price: '100.5', time: String(nowSeconds - 86_400) },
                  { price: '101.7', time: String(nowSeconds) },
                ],
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    );

    const result = await cryptoCoinbaseCandles({ pairs: ['BTC-USD'], days: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetch).toHaveBeenCalledWith(
      'https://api.coinbase.com/v2/prices/BTC-USD/historic?period=year',
      { headers: { accept: 'application/json' } },
    );
    expect(result.points).toEqual([
      {
        dimensions: { pair: 'BTC-USD' },
        value: 100.5,
        unit: 'USD',
        ts: (nowSeconds - 86_400) * 1000,
        sourceUrl: 'https://www.coinbase.com/price/btc',
      },
      {
        dimensions: { pair: 'BTC-USD' },
        value: 101.7,
        unit: 'USD',
        ts: nowSeconds * 1000,
        sourceUrl: 'https://www.coinbase.com/price/btc',
      },
    ]);
    const raw = result.rawPayload as { perPair: Record<string, unknown> };
    const btcRaw = raw.perPair['BTC-USD'];
    expect(Array.isArray(btcRaw)).toBe(true);
    expect((btcRaw as unknown[])[0]).toMatchObject({
      data: { base: 'BTC', currency: 'USD' },
    });
  });

  it('preserves retryable rate-limit errors when all pairs fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '180' },
        }),
      ),
    );

    const result = await cryptoCoinbaseCandles({ pairs: ['BTC-USD'], days: 1 });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Coinbase rate limited',
        retryAfterSeconds: 180,
      },
    });
  });
});
