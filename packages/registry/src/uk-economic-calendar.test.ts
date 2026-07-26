import { describe, expect, it } from 'vitest';
import { ukEconomicCalendarTemplate } from './uk-economic-calendar';

const anyHintMatches = (prompt: string): boolean =>
  ukEconomicCalendarTemplate.matchHints.some((rx) => rx.test(prompt));

describe('ukEconomicCalendarTemplate.matchHints', () => {
  it.each([
    'UK economic calendar',
    'macro calendar UK',
    'Bank of England publications',
    'BoE calendar',
    'rate decision',
    'Monetary Policy Summary',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'Cloudflare status'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('ukEconomicCalendarTemplate metadata', () => {
  it('uses public source policy and six-hour refresh', () => {
    expect(ukEconomicCalendarTemplate.paramKeys).toEqual([]);
    expect(ukEconomicCalendarTemplate.rightsStatus).toBe('public');
    expect(ukEconomicCalendarTemplate.defaultRefreshSeconds).toBe(21_600);
  });
});
