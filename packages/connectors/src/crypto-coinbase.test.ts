import { afterEach, describe, expect, it, vi } from 'vitest';
import { cryptoCoinbase } from './crypto-coinbase';

const spotResponse = (pair: string, amount: string): Response => {
  const [base, currency] = pair.split('-');
  return new Response(JSON.stringify({ data: { amount, base, currency } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cryptoCoinbase', () => {
  it('returns one DataPoint per pair on happy path', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('BTC-USD')) return Promise.resolve(spotResponse('BTC-USD', '64210.55'));
      if (url.includes('ETH-USD')) return Promise.resolve(spotResponse('ETH-USD', '3120.10'));
      return Promise.resolve(new Response('not found', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cryptoCoinbase({ pairs: ['BTC-USD', 'ETH-USD'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(2);
    const btc = result.points.find((p) => p.dimensions['pair'] === 'BTC-USD');
    if (!btc) throw new Error('expected BTC point');
    expect(btc.value).toBe(64210.55);
    expect(btc.unit).toBe('USD');
    expect(typeof btc.ts).toBe('number');
  });

  it('returns ok:true with partial success when one pair 404s', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('BTC-USD')) return Promise.resolve(spotResponse('BTC-USD', '64210.55'));
      return Promise.resolve(new Response('not found', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cryptoCoinbase({ pairs: ['BTC-USD', 'XYZ-USD'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    const [only] = result.points;
    if (!only) throw new Error('expected one point');
    expect(only.dimensions['pair']).toBe('BTC-USD');
  });

  it('returns ok:false when all pairs fail (fetch_failed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));

    const result = await cryptoCoinbase({ pairs: ['BTC-USD', 'ETH-USD'] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
  });

  it('treats malformed JSON for all pairs as failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await cryptoCoinbase({ pairs: ['BTC-USD'] });

    expect(result.ok).toBe(false);
  });
});
