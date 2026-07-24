import { describe, expect, it } from 'vitest';
import { macroMarketHistoryTemplate } from './macro-market-history';

const anyHintMatches = (prompt: string): boolean =>
  macroMarketHistoryTemplate.matchHints.some((rx) => rx.test(prompt));

describe('macroMarketHistoryTemplate.matchHints', () => {
  it.each([
    'UK 10Y gilt yield',
    'GBP/USD one year chart',
    'gold yearly graph',
    'WTI crude oil history',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });
});

describe('macroMarketHistoryTemplate.paramExtractors.preset', () => {
  const { preset } = macroMarketHistoryTemplate.paramExtractors;

  it('maps Rob daily macro aliases to free-source presets', () => {
    expect(preset?.('UK 10Y gilt yield')).toBe('uk-10y-gilt');
    expect(preset?.('sterling pound dollar')).toBe('gbp-usd');
    expect(preset?.('gold price')).toBe('gold');
    expect(preset?.('WTI crude oil')).toBe('crude-oil');
  });

  it('returns undefined when no macro preset is present', () => {
    expect(preset?.('daily collection please')).toBeUndefined();
  });
});
