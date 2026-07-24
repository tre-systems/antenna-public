import { afterEach, describe, expect, it, vi } from 'vitest';
import { tradingEconomicsMarket } from './trading-economics-market';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tradingEconomicsMarket', () => {
  it('returns setup error when the API key is missing', async () => {
    const result = await tradingEconomicsMarket({ symbol: 'XAUUSD:CUR' });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'TRADING_ECONOMICS_API_KEY is required for Trading Economics market data',
      },
    });
  });

  it('maps historical rows to daily data points with source attribution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { Symbol: 'XAUUSD:CUR', Date: '14/04/2026', Close: 258.83 },
            { Symbol: 'XAUUSD:CUR', Date: '2026-04-15T00:00:00', Close: '261.2' },
            { Symbol: 'XAUUSD:CUR', Date: 'bad', Close: 262.1 },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await tradingEconomicsMarket({
      symbol: 'XAUUSD:CUR',
      apiKey: 'secret',
      label: 'Gold',
      unit: 'USD/t.oz',
      sourceUrl: 'https://tradingeconomics.com/commodity/gold',
      days: 7,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof url).toBe('string');
    if (typeof url !== 'string') throw new Error('expected fetch URL string');
    expect(url).toMatch(
      /^https:\/\/api\.tradingeconomics\.com\/markets\/historical\/XAUUSD%3ACUR\?/,
    );
    expect(url).toContain('c=secret');
    expect(url).toContain('f=json');
    expect(init).toEqual({ headers: { accept: 'application/json' } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      {
        dimensions: { symbol: 'XAUUSD:CUR', label: 'Gold' },
        value: 258.83,
        unit: 'USD/t.oz',
        ts: Date.UTC(2026, 3, 14),
        sourceUrl: 'https://tradingeconomics.com/commodity/gold',
      },
      {
        dimensions: { symbol: 'XAUUSD:CUR', label: 'Gold' },
        value: 261.2,
        unit: 'USD/t.oz',
        ts: Date.parse('2026-04-15T00:00:00'),
        sourceUrl: 'https://tradingeconomics.com/commodity/gold',
      },
    ]);
  });

  it('translates credential failures into unauthorized adapter errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gone', { status: 410 })));

    const result = await tradingEconomicsMarket({ symbol: 'GBPUSD:CUR', apiKey: 'bad' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Trading Economics rejected credentials' },
    });
  });

  it('maps rate limits to retryable adapter errors with Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('slow down', {
          status: 429,
          headers: { 'retry-after': '240' },
        }),
      ),
    );

    const result = await tradingEconomicsMarket({ symbol: 'GBPUSD:CUR', apiKey: 'secret' });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Trading Economics rate limited',
        retryAfterSeconds: 240,
      },
    });
  });
});
