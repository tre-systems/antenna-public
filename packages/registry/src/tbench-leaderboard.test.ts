import { describe, expect, it } from 'vitest';
import { tbenchLeaderboardTemplate } from './tbench-leaderboard';

const anyHintMatches = (prompt: string): boolean =>
  tbenchLeaderboardTemplate.matchHints.some((rx) => rx.test(prompt));

describe('tbenchLeaderboardTemplate.matchHints', () => {
  it.each([
    'Terminal-Bench leaderboard',
    'tbench',
    'tbench leaderboard',
    'AI agent leaderboard',
    'agent benchmark results',
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

describe('tbenchLeaderboardTemplate metadata', () => {
  it('validates optional version and limit config', () => {
    expect(tbenchLeaderboardTemplate.configSchema.parse({})).toEqual({});
    expect(tbenchLeaderboardTemplate.configSchema.parse({ version: '2.1', limit: 10 })).toEqual({
      version: '2.1',
      limit: 10,
    });
    expect(() => tbenchLeaderboardTemplate.configSchema.parse({ limit: 11 })).toThrow();
    expect(() => tbenchLeaderboardTemplate.configSchema.parse({ version: '../private' })).toThrow();
    expect(() =>
      tbenchLeaderboardTemplate.configSchema.parse({ url: 'https://example.com' }),
    ).toThrow();
  });

  it('uses a conservative refresh cadence for an HTML-derived source', () => {
    expect(tbenchLeaderboardTemplate.rightsStatus).toBe('with-attribution');
    expect(tbenchLeaderboardTemplate.defaultRefreshSeconds).toBe(21600);
  });
});
