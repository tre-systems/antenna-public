import { describe, expect, it } from 'vitest';
import { resolvePointDisplay, resolveTemplateDisplay } from './display';

describe('resolveTemplateDisplay', () => {
  it('drops executable source URLs from configs and points', () => {
    expect(
      resolveTemplateDisplay('rest-metric', 'Unsafe', { url: 'javascript:alert(1)' }).sourceUrl,
    ).toBeNull();
    expect(
      resolvePointDisplay('cloudflare-incidents', {
        dimensions: {},
        sourceUrl: 'data:text/html,<script>alert(1)</script>',
      }).sourceUrl,
    ).toBeNull();
  });

  it('resolves configured FX titles and source links', () => {
    expect(resolveTemplateDisplay('fx-pair', 'FX pair', { base: 'eur', quote: 'usd' })).toEqual({
      title: 'eur/usd',
      sourceLabel: 'Frankfurter (ECB)',
      sourceUrl: 'https://frankfurter.dev/?from=EUR&to=USD',
    });
  });

  it('prefers observed point source URLs over configured defaults', () => {
    expect(
      resolveTemplateDisplay('fx-pair', 'FX pair', { base: 'EUR', quote: 'USD' }, [
        null,
        'https://example.test/source',
      ]),
    ).toMatchObject({
      sourceUrl: 'https://example.test/source',
    });
  });

  it('resolves list titles and source links for watchlists', () => {
    expect(
      resolveTemplateDisplay('crypto-history', 'Crypto history', {
        pairs: 'BTC-USD, ETH-USD, SOL-USD, DOGE-USD',
      }),
    ).toEqual({
      title: 'Crypto history: BTC, ETH, SOL +1 more',
      sourceLabel: 'Coinbase',
      sourceUrl: 'https://www.coinbase.com/price/btc',
    });
  });

  it('resolves macro preset labels and source ownership', () => {
    expect(
      resolveTemplateDisplay('macro-market-history', 'Macro market history', { preset: 'gold' }),
    ).toEqual({
      title: 'Gold 1Y',
      sourceLabel: 'Yahoo Finance',
      sourceUrl: 'https://finance.yahoo.com/quote/GC=F/',
    });
  });

  it('resolves market history symbols and explicit label overrides', () => {
    expect(
      resolveTemplateDisplay('market-history', 'Market history', { symbol: 'MSFT' }),
    ).toMatchObject({
      title: 'MSFT 1Y',
      sourceLabel: 'Yahoo Finance',
      sourceUrl: 'https://finance.yahoo.com/quote/MSFT/',
    });

    expect(
      resolveTemplateDisplay('market-history', 'Market history', {
        symbol: 'GC=F',
        label: 'Gold',
      }),
    ).toMatchObject({
      title: 'Gold 1Y',
    });
  });

  it('resolves specialised radar titles in the registry', () => {
    expect(resolveTemplateDisplay('sector-movers', 'Fallback', {})).toMatchObject({
      title: 'US sector movers',
      sourceLabel: 'Yahoo Finance',
    });
    expect(resolveTemplateDisplay('tbench-leaderboard', 'Fallback', {})).toMatchObject({
      title: 'Terminal Bench leaderboard',
      sourceLabel: 'Terminal Bench',
    });
    expect(
      resolveTemplateDisplay('aa-highlights', 'Fallback', { category: 'speed' }),
    ).toMatchObject({
      title: 'AA Speed',
      sourceLabel: 'Artificial Analysis',
    });
    expect(resolveTemplateDisplay('aa-highlights', 'Fallback', {})).toMatchObject({
      title: 'AA Intelligence',
    });
  });

  it('names the app in usage titles so multiple usage cards are distinguishable', () => {
    expect(resolveTemplateDisplay('app-usage', 'App usage', { project: 'example-app' }).title).toBe(
      'Example-app usage',
    );
    expect(
      resolveTemplateDisplay('app-usage', 'App usage', { project: 'sample-service' }).title,
    ).toBe('Sample-service usage');
    // Missing project falls back rather than showing a bare slug.
    expect(resolveTemplateDisplay('app-usage', 'App usage', {}).title).toBe('App usage');
    expect(resolveTemplateDisplay('cloudflare-analytics', 'Fallback', {}).title).toBe(
      'Cloudflare traffic',
    );
  });

  it('uses provider and project to distinguish cost cards', () => {
    expect(
      resolveTemplateDisplay('manual-cost', 'Manual cost', {
        provider: 'Cloudflare',
        project: 'Antenna',
      }),
    ).toMatchObject({
      title: 'Cloudflare · Antenna costs',
      sourceLabel: 'Manual cost entry',
    });
    expect(resolveTemplateDisplay('manual-cost', 'Manual cost', { provider: 'Modal' }).title).toBe(
      'Modal costs',
    );
  });

  it('falls back to source policy URLs for specialised cards', () => {
    expect(resolveTemplateDisplay('tbench-leaderboard', 'Terminal Bench leaderboard', {})).toEqual({
      title: 'Terminal Bench leaderboard',
      sourceLabel: 'Terminal Bench',
      sourceUrl: 'https://www.tbench.ai/leaderboard/terminal-bench/2.0',
    });
  });
});

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
