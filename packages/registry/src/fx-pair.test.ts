import { describe, expect, it } from 'vitest';
import { fxPairTemplate } from './fx-pair';

const anyHintMatches = (prompt: string): boolean =>
  fxPairTemplate.matchHints.some((rx) => rx.test(prompt));

describe('fxPairTemplate.matchHints', () => {
  it.each([
    'show me the EUR/USD exchange rate',
    'I want to track CHF to GBP',
    'add an FX signal',
    'forex tile for USD-JPY',
    'track currency moves',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['the weather in Berlin', 'show me Bitcoin price', 'a list of football scores'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('fxPairTemplate.paramExtractors', () => {
  const { base, quote } = fxPairTemplate.paramExtractors;

  it('extracts base/quote from slash form', () => {
    expect(base?.('show EUR/USD')).toBe('EUR');
    expect(quote?.('show EUR/USD')).toBe('USD');
  });

  it('extracts from "to" form regardless of case', () => {
    expect(base?.('track chf to gbp please')).toBe('CHF');
    expect(quote?.('track chf to gbp please')).toBe('GBP');
  });

  it('extracts from hyphenated form', () => {
    expect(base?.('USD-JPY tile')).toBe('USD');
    expect(quote?.('USD-JPY tile')).toBe('JPY');
  });

  it('returns undefined when no pair is present', () => {
    expect(base?.('just some words')).toBeUndefined();
    expect(quote?.('just some words')).toBeUndefined();
  });
});
