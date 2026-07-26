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
      sourceUrl: 'https://www.frankfurter.app/?from=EUR&to=USD',
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

  it('resolves market history friendly labels and explicit label overrides', () => {
    expect(
      resolveTemplateDisplay('market-history', 'Market history', { symbol: '0P000125KV.L' }),
    ).toMatchObject({
      title: 'Fidelity Index World P 1Y',
      sourceLabel: 'Yahoo Finance',
      sourceUrl: 'https://finance.yahoo.com/quote/0P000125KV.L/',
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

  it('resolves specialised dogfood radar titles in the registry', () => {
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
    expect(resolveTemplateDisplay('app-usage', 'App usage', { project: 'comprehendo' }).title).toBe(
      'Comprehendo usage',
    );
    expect(
      resolveTemplateDisplay('app-usage', 'App usage', { project: 'swade-toolbox' }).title,
    ).toBe('Swade-toolbox usage');
    expect(resolveTemplateDisplay('app-usage', 'App usage', { project: 'rgou' }).title).toBe(
      'Royal Game of Ur usage',
    );
    expect(resolveTemplateDisplay('app-usage', 'App usage', { project: 'talata' }).title).toBe(
      'Talata usage',
    );
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
