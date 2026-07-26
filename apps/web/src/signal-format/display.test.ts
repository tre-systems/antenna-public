import { describe, expect, it } from 'vitest';
import { pointSourceUrl, signalSourceLabel, signalSourceUrl, signalTitle } from './display';
import { makeSignal } from './test-support';

describe('pointSourceUrl', () => {
  it('prefers server-resolved point display source URLs', () => {
    expect(
      pointSourceUrl(
        {
          dimensions: { ticker: 'VTI.US' },
          value: 360,
          source_url: 'https://legacy.example/source',
          display: { label: 'VTI', source_url: 'https://server.example/source' },
        },
        makeSignal({ template_id: 'equity-watchlist' }),
      ),
    ).toBe('https://server.example/source');
  });

  it('drops executable point links', () => {
    expect(
      pointSourceUrl(
        {
          dimensions: {},
          value: 1,
          display: { label: 'Unsafe', source_url: 'javascript:alert(1)' },
        },
        makeSignal({ template_id: 'manual-metric' }),
      ),
    ).toBeNull();
  });
});

describe('signalTitle', () => {
  it('prefers server-resolved display titles when available', () => {
    expect(
      signalTitle(
        makeSignal({
          template_id: 'fx-pair',
          config: { base: 'EUR', quote: 'USD' },
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('Server title');
  });

  it('uses macro preset labels for free macro history signals', () => {
    expect(
      signalTitle(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'gbp-usd' } }),
      ),
    ).toBe('GBP/USD 1Y');
  });

  it('humanises known Morningstar codes in market-history titles', () => {
    expect(
      signalTitle(
        makeSignal({ template_id: 'market-history', config: { symbol: '0P000125KV.L' } }),
      ),
    ).toBe('Fidelity Index World P 1Y');
    expect(
      signalTitle(makeSignal({ template_id: 'market-history', config: { symbol: 'BA.L' } })),
    ).toBe('BA 1Y');
    // cfg.label overrides everything so a seed can rename without a SPA map
    expect(
      signalTitle(
        makeSignal({
          template_id: 'market-history',
          config: { symbol: '0P000125KV.L', label: 'My pension fund' },
        }),
      ),
    ).toBe('My pension fund 1Y');
  });
});

describe('signalSourceLabel', () => {
  it('prefers server-resolved source labels when available', () => {
    expect(
      signalSourceLabel(
        makeSignal({
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('Server source');
  });

  it('uses the concrete source label for macro presets', () => {
    expect(
      signalSourceLabel(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'uk-10y-gilt' } }),
      ),
    ).toBe('Bank of England');
    expect(
      signalSourceLabel(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'crude-oil' } }),
      ),
    ).toBe('EIA');
  });
});

describe('signalSourceUrl', () => {
  it('prefers server-resolved source URLs when available', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('https://example.test/source');
  });

  it('drops executable signal links', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          template_id: 'rest-metric',
          config: { url: 'javascript:alert(1)' },
          display: { title: 'Unsafe', source_label: 'Unsafe', source_url: 'javascript:alert(1)' },
        }),
      ),
    ).toBeNull();
  });

  it('returns the first point source URL when present', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          points: [
            { dimensions: { label: 'A' }, value: 1, ts: 0 },
            {
              dimensions: { label: 'B' },
              value: 2,
              ts: 0,
              source_url: 'https://example.test/source',
            },
          ],
        }),
      ),
    ).toBe('https://example.test/source');
  });

  it('falls back to source config and known template source pages', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          template_id: 'trading-economics-market',
          config: { sourceUrl: 'https://tradingeconomics.com/commodity/gold' },
        }),
      ),
    ).toBe('https://tradingeconomics.com/commodity/gold');
    expect(
      signalSourceUrl(makeSignal({ template_id: 'market-history', config: { symbol: 'BA.L' } })),
    ).toBe('https://finance.yahoo.com/quote/BA.L/');
    expect(
      signalSourceUrl(makeSignal({ template_id: 'crypto-history', config: { pairs: 'BTC-USD' } })),
    ).toBe('https://www.coinbase.com/price/btc');
    expect(
      signalSourceUrl(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'crude-oil' } }),
      ),
    ).toBe('https://www.eia.gov/dnav/pet/hist/RWTCd.htm');
  });
});
