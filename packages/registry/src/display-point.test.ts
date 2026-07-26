import { describe, expect, it } from 'vitest';
import { resolvePointDisplay } from './display';

describe('resolvePointDisplay', () => {
  it('uses rank labels before metric labels for ranked rows', () => {
    expect(
      resolvePointDisplay('cisa-kev-recent', {
        dimensions: { metric: 'recent_vulnerability', rank: 2 },
      }),
    ).toEqual({ label: '#2', sourceUrl: null });
    expect(
      resolvePointDisplay('github-security-advisories', {
        dimensions: { metric: 'advisory', rank: '1' },
      }),
    ).toEqual({ label: '#1', sourceUrl: null });
  });

  it('returns compact labels for common metric points', () => {
    expect(
      resolvePointDisplay('weather', {
        dimensions: { metric: 'temperature', location: 'London' },
      }),
    ).toEqual({ label: 'Temp', sourceUrl: null });
    expect(
      resolvePointDisplay('airquality', {
        dimensions: { metric: 'aqi', location: 'London' },
      }),
    ).toEqual({ label: 'AQI', sourceUrl: null });
    expect(
      resolvePointDisplay('karpathy-jobs-snapshot', {
        dimensions: { metric: 'weighted_ai_exposure' },
      }),
    ).toEqual({ label: 'AI exposure', sourceUrl: null });
  });

  it('links row-level equity and crypto points to their source pages', () => {
    expect(
      resolvePointDisplay('equity-watchlist', {
        dimensions: { ticker: 'VTI.US' },
      }),
    ).toEqual({ label: 'VTI', sourceUrl: 'https://stooq.com/q/?s=vti.us' });
    expect(
      resolvePointDisplay('crypto-watchlist', {
        dimensions: { pair: 'BTC-USD' },
      }),
    ).toEqual({ label: 'BTC-USD', sourceUrl: 'https://www.coinbase.com/price/btc' });
  });

  it('extracts GitHub Trending repo links from value text', () => {
    expect(
      resolvePointDisplay('github-trending', {
        dimensions: { rank: '1' },
        valueText: 'openai/codex · TypeScript · +120 stars today',
      }),
    ).toEqual({ label: '#1', sourceUrl: 'https://github.com/openai/codex' });
  });

  it('uses the market proxy label for market overview rows', () => {
    expect(
      resolvePointDisplay('market-overview', {
        dimensions: { metric: 'market_proxy_change', label: 'US equities', ticker: 'VTI.US' },
        sourceUrl: 'https://stooq.com/q/?s=vti.us',
      }),
    ).toEqual({ label: 'US equities', sourceUrl: 'https://stooq.com/q/?s=vti.us' });
  });

  it('prefers adapter-provided point source URLs', () => {
    expect(
      resolvePointDisplay('github-trending', {
        dimensions: { rank: '2' },
        valueText: 'ignored/repo · Go',
        sourceUrl: 'https://example.test/custom',
      }),
    ).toEqual({ label: '#2', sourceUrl: 'https://example.test/custom' });
  });
});
