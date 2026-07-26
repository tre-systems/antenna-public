import { describe, expect, it } from 'vitest';
import { sectorMoversTemplate } from './sector-movers';

const anyHintMatches = (prompt: string): boolean =>
  sectorMoversTemplate.matchHints.some((rx) => rx.test(prompt));

describe('sectorMoversTemplate.matchHints', () => {
  it.each([
    'sector heatmap',
    'market heatmap',
    'show me sector movers',
    'biggest market movers today',
    'sectors today',
    'S&P sectors',
    'SP500 sectors',
    'sector performance',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'BA.L yearly graph', 'CISA KEV'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('sectorMoversTemplate metadata', () => {
  it('has no user params and refreshes every 10 minutes', () => {
    expect(sectorMoversTemplate.paramKeys).toEqual([]);
    expect(sectorMoversTemplate.rightsStatus).toBe('with-attribution');
    expect(sectorMoversTemplate.defaultRefreshSeconds).toBe(600);
  });
});
