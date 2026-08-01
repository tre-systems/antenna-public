// Renders via preact-render-to-string for assertion against output HTML — keeps deps light (no JSDOM, no testing-library).
import { describe, it, expect } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import { makeSignal, NOW } from './signal-card-test-fixtures';

describe('SignalCard', () => {
  it('renders the server-resolved title, source label, and formatted point value', () => {
    const html = renderToString(<SignalCard signal={makeSignal()} />);
    expect(html).toContain('EUR/USD');
    expect(html).toContain('Frankfurter (ECB)');
    // FX precision follows the shared card value formatter.
    expect(html).toContain('1.09');
    expect(html).not.toContain('1.0876');
    expect(html).toContain('data-status="live"');
  });

  it('renders manual cost signals as private currency cards', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'manual-cost',
          config: {
            amount: 12.34,
            currency: 'GBP',
            period: 'month_to_date',
            provider: 'Cloudflare',
            service: 'Workers',
            project: 'Antenna',
          },
          display: {
            title: 'Cloudflare · Antenna costs',
            source_label: 'Manual cost entry',
            source_url: null,
          },
          points: [
            {
              dimensions: {
                family: 'cost',
                metric: 'cost',
                period: 'month_to_date',
                posture: 'manual',
                provider: 'Cloudflare',
                service: 'Workers',
                project: 'Antenna',
              },
              value: 12.34,
              unit: 'GBP',
              ts: NOW,
            },
          ],
        })}
      />,
    );

    expect(html).toContain('Cloudflare · Antenna costs');
    expect(html).toContain('£12.34');
    expect(html).toContain('month to date');
    expect(html).toContain('manual');
  });

  it('starts owner cards in compact detail mode', () => {
    const html = renderToString(<SignalCard signal={makeSignal()} />);
    expect(html).toContain('data-expanded="false"');
    expect(html).toContain('data-testid="signal-card-header"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Expand signal details"');
    expect(html).not.toContain('>Open<');
    expect(html).not.toContain('>Details<');
  });

  it('keeps headerless presentation cards expanded', () => {
    const html = renderToString(<SignalCard signal={makeSignal()} hideHeader />);
    expect(html).toContain('data-expanded="true"');
    expect(html).not.toContain('Expand signal details');
  });

  it('keeps expanded details user-facing and omits connector config', () => {
    const html = renderToString(
      <SignalCard
        hideHeader
        signal={makeSignal({
          template_id: 'macro-market-history',
          config: { preset: 'gbp-usd' },
          refresh_seconds: 21_600,
        })}
      />,
    );

    expect(html).toContain('Last updated');
    expect(html).toContain('Every 6h');
    expect(html).toContain('Private');
    expect(html).not.toContain('Preset');
    expect(html).not.toContain('gbp-usd');
  });

  it('renders server-resolved crypto watchlist titles for supported config shapes', () => {
    const fromArray = makeSignal({
      template_id: 'crypto-watchlist',
      config: { pairs: ['BTC-USD', 'ETH-USD'] },
      display: {
        title: 'Crypto: BTC, ETH',
        source_label: 'Coinbase',
        source_url: 'https://www.coinbase.com/',
      },
      points: [
        { dimensions: { pair: 'BTC-USD' }, value: 65432.1, ts: NOW },
        { dimensions: { pair: 'ETH-USD' }, value: 3210.5, ts: NOW },
      ],
    });
    expect(renderToString(<SignalCard signal={fromArray} />)).toContain('Crypto: BTC, ETH');

    // Registry stores the param as a comma-joined string; same UI title.
    const fromString = makeSignal({
      template_id: 'crypto-watchlist',
      config: { pairs: 'BTC-USD,ETH-USD' },
      display: {
        title: 'Crypto: BTC, ETH',
        source_label: 'Coinbase',
        source_url: 'https://www.coinbase.com/',
      },
      points: [{ dimensions: { pair: 'BTC-USD' }, value: 65432.1, ts: NOW }],
    });
    const html = renderToString(<SignalCard signal={fromString} />);
    expect(html).toContain('Crypto: BTC, ETH');
    expect(html).toContain('Coinbase');
  });

  it('collapses long watchlists to "first three + N more" so signals stay tidy', () => {
    const signal = makeSignal({
      template_id: 'crypto-watchlist',
      config: { pairs: 'BTC-USD,ETH-USD,SOL-USD,ADA-USD,DOGE-USD' },
      display: {
        title: 'Crypto: BTC, ETH, SOL +2 more',
        source_label: 'Coinbase',
        source_url: 'https://www.coinbase.com/',
      },
      points: [],
    });
    expect(renderToString(<SignalCard signal={signal} />)).toContain(
      'Crypto: BTC, ETH, SOL +2 more',
    );
  });

  it('formats equity-watchlist titles and strips exchange suffixes', () => {
    const signal = makeSignal({
      template_id: 'equity-watchlist',
      config: { tickers: 'BA.UK,VTI.US,ANTO.L,PII.L' },
      display: {
        title: 'Stocks: BA, VTI, ANTO +1 more',
        source_label: 'Stooq',
        source_url: 'https://stooq.com/',
      },
      points: [],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('Stocks: BA, VTI, ANTO +1 more');
    expect(html).toContain('Stooq');
  });

  it('renders Worker text values from value_text instead of numeric value', () => {
    const signal = makeSignal({
      template_id: 'github-trending',
      config: {},
      points: [
        {
          dimensions: { metric: 'next_event' },
          value: null,
          value_text: 'PBOC LPR Decision',
          unit: null,
        },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('PBOC LPR Decision');
    expect(html).not.toContain('null');
  });
});
