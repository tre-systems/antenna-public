import { describe, expect, it } from 'vitest';
import { equityWatchlistTemplate } from './equity-watchlist';

const anyHintMatches = (prompt: string): boolean =>
  equityWatchlistTemplate.matchHints.some((rx) => rx.test(prompt));

describe('equityWatchlistTemplate.matchHints', () => {
  it.each([
    'add a stock tile',
    'I want to track stocks',
    'a watchlist of tickers',
    'equity tracker',
    'share price for AAPL',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Berlin', 'bitcoin price', 'football scores'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('equityWatchlistTemplate.paramExtractors.tickers', () => {
  const { tickers } = equityWatchlistTemplate.paramExtractors;

  it('extracts a single ticker with US suffix', () => {
    expect(tickers?.('track AAPL.US please')).toBe('AAPL.US');
  });

  it('extracts multiple comma-separated tickers and defaults bare symbols to .US', () => {
    // Stooq requires an exchange suffix — a bare 'AAPL' returns no rows.
    expect(tickers?.('watchlist of AAPL, MSFT, GOOGL')).toBe('AAPL.US,MSFT.US,GOOGL.US');
  });

  it('leaves explicit exchange suffixes alone', () => {
    expect(tickers?.('track AZN.UK and VTI.US')).toBe('AZN.UK,VTI.US');
  });

  it('ignores common stopwords and currency codes', () => {
    expect(tickers?.('I want a watchlist for stocks in USD')).toBeUndefined();
  });

  it('returns undefined when no tickers are present', () => {
    expect(tickers?.('just some words')).toBeUndefined();
  });

  it('deduplicates repeated tickers (after the .US default is applied)', () => {
    expect(tickers?.('AAPL and AAPL again')).toBe('AAPL.US');
  });
});
