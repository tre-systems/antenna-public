import { describe, expect, it } from 'vitest';
import { githubTrendingTemplate } from './github-trending';

const anyHintMatches = (prompt: string): boolean =>
  githubTrendingTemplate.matchHints.some((rx) => rx.test(prompt));

describe('githubTrendingTemplate.matchHints', () => {
  it.each([
    'GitHub Trending',
    'show trending repos',
    'trending repositories on GitHub',
    'what developer tools are trending',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['track stars for example/antenna', 'weather in London', 'bitcoin yearly graph'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('githubTrendingTemplate metadata', () => {
  it('is attribution-reviewed and refreshes daily-ish', () => {
    expect(githubTrendingTemplate.paramKeys).toEqual([]);
    expect(githubTrendingTemplate.rightsStatus).toBe('with-attribution');
    expect(githubTrendingTemplate.defaultRefreshSeconds).toBe(21_600);
  });
});
