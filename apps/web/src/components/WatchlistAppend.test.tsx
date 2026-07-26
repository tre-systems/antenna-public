// Render-only tests plus pure helper tests. The async edit/save flow
// needs a real DOM and is exercised in e2e.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { appendConfig, WatchlistAppend } from './WatchlistAppend';
import type { ApiSignal } from '../api';

const baseSignal = (overrides: Partial<ApiSignal> = {}): ApiSignal => ({
  id: 'b1',
  template_id: 'fx-pair',
  visibility: 'private',
  config: {},
  refresh_seconds: 600,
  status: {
    status: 'live',
    last_ok_at: 0,
    last_attempt_at: 0,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [],
  ...overrides,
});

describe('appendConfig', () => {
  it('exposes a pairs-shaped config for crypto-watchlist', () => {
    const cfg = appendConfig(
      baseSignal({ template_id: 'crypto-watchlist', config: { pairs: 'BTC-USD,ETH-USD' } }),
    );
    expect(cfg).not.toBeNull();
    expect(cfg?.field).toBe('pairs');
    expect(cfg?.split()).toEqual(['BTC-USD', 'ETH-USD']);
    expect(cfg?.normalise('sol')).toBe('SOL-USD');
    expect(cfg?.normalise('SOL-USD')).toBe('SOL-USD');
    expect(cfg?.isValid('SOL-USD')).toBe(true);
    expect(cfg?.isValid('SOL')).toBe(false);
  });

  it('exposes a tickers-shaped config for equity-watchlist', () => {
    const cfg = appendConfig(
      baseSignal({ template_id: 'equity-watchlist', config: { tickers: 'BA.UK,VTI.US' } }),
    );
    expect(cfg).not.toBeNull();
    expect(cfg?.field).toBe('tickers');
    expect(cfg?.split()).toEqual(['BA.UK', 'VTI.US']);
    expect(cfg?.normalise('aapl.us')).toBe('AAPL.US');
    expect(cfg?.isValid('AAPL.US')).toBe(true);
    expect(cfg?.isValid('AAPL')).toBe(false);
  });

  it('returns null for non-watchlist templates so the component renders nothing', () => {
    expect(appendConfig(baseSignal({ template_id: 'fx-pair' }))).toBeNull();
    expect(appendConfig(baseSignal({ template_id: 'weather' }))).toBeNull();
  });
});

describe('WatchlistAppend', () => {
  it('renders the trigger button for a crypto watchlist', () => {
    const html = renderToString(
      <WatchlistAppend
        signal={baseSignal({ template_id: 'crypto-watchlist', config: { pairs: 'BTC-USD' } })}
      />,
    );
    expect(html).toContain('data-testid="watchlist-append-trigger-b1"');
    expect(html).toContain('+ Add pair');
  });

  it('renders the trigger button for an equity watchlist', () => {
    const html = renderToString(
      <WatchlistAppend
        signal={baseSignal({ template_id: 'equity-watchlist', config: { tickers: 'BA.UK' } })}
      />,
    );
    expect(html).toContain('+ Add ticker');
  });

  it('renders nothing for other templates', () => {
    const html = renderToString(
      <WatchlistAppend signal={baseSignal({ template_id: 'fx-pair' })} />,
    );
    expect(html).toBe('');
  });
});
