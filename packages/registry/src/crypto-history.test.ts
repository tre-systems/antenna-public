import { describe, expect, it } from 'vitest';
import { cryptoHistoryTemplate } from './crypto-history';

const anyHintMatches = (prompt: string): boolean =>
  cryptoHistoryTemplate.matchHints.some((rx) => rx.test(prompt));

describe('cryptoHistoryTemplate.matchHints', () => {
  it.each(['bitcoin yearly graph', 'BTC 1Y chart', 'crypto history for ETH'])(
    'matches "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(true);
    },
  );

  it.each(['BTC price', 'yearly graph for gold'])('does not match "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(false);
  });
});

describe('cryptoHistoryTemplate.paramExtractors.pairs', () => {
  const { pairs } = cryptoHistoryTemplate.paramExtractors;

  it('extracts known crypto symbols and aliases', () => {
    expect(pairs?.('bitcoin yearly graph')).toBe('BTC-USD');
    expect(pairs?.('BTC and ETH 1Y chart')).toBe('BTC-USD,ETH-USD');
  });

  it('returns undefined when no known crypto appears', () => {
    expect(pairs?.('gold yearly graph')).toBeUndefined();
  });
});
