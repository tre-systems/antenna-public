import { describe, expect, it } from 'vitest';
import { cryptoWatchlistTemplate } from './crypto-watchlist';

const anyHintMatches = (prompt: string): boolean =>
  cryptoWatchlistTemplate.matchHints.some((rx) => rx.test(prompt));

describe('cryptoWatchlistTemplate.matchHints', () => {
  it.each([
    'track bitcoin',
    'show me BTC and ETH',
    'a crypto signal please',
    'ethereum price tile',
    'add SOL-USD',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['the EUR/USD exchange rate', 'tomorrow weather', 'football scores'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('cryptoWatchlistTemplate.paramExtractors.pairs', () => {
  const { pairs } = cryptoWatchlistTemplate.paramExtractors;

  it('extracts single ticker', () => {
    expect(pairs?.('show me BTC')).toBe('BTC-USD');
  });

  it('extracts multiple tickers joined by "and"', () => {
    expect(pairs?.('track BTC and ETH')).toBe('BTC-USD,ETH-USD');
  });

  it('extracts comma-separated tickers', () => {
    expect(pairs?.('I want SOL, ADA, DOGE')).toBe('SOL-USD,ADA-USD,DOGE-USD');
  });

  it('resolves long-form aliases', () => {
    expect(pairs?.('track bitcoin and ethereum')).toBe('BTC-USD,ETH-USD');
  });

  it('returns undefined when nothing recognised', () => {
    expect(pairs?.('just some words')).toBeUndefined();
  });
});
