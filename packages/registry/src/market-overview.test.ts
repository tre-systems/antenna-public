import { describe, expect, it } from 'vitest';
import { marketOverviewTemplate } from './market-overview';

const anyHintMatches = (prompt: string): boolean =>
  marketOverviewTemplate.matchHints.some((rx) => rx.test(prompt));

describe('marketOverviewTemplate.matchHints', () => {
  it.each([
    'market overview',
    'market sentiment',
    'is it risk-on today',
    'risk off signal',
    'Finviz overview',
    'highest level market view',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'BA.L yearly graph'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('marketOverviewTemplate metadata', () => {
  it('has no user params and uses an attributed Stooq-backed source', () => {
    expect(marketOverviewTemplate.paramKeys).toEqual([]);
    expect(marketOverviewTemplate.rightsStatus).toBe('with-attribution');
    expect(marketOverviewTemplate.defaultRefreshSeconds).toBe(1800);
  });
});
