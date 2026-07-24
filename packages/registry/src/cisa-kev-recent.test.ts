import { describe, expect, it } from 'vitest';
import { cisaKevRecentTemplate } from './cisa-kev-recent';

const anyHintMatches = (prompt: string): boolean =>
  cisaKevRecentTemplate.matchHints.some((rx) => rx.test(prompt));

describe('cisaKevRecentTemplate.matchHints', () => {
  it.each([
    'CISA KEV',
    'known exploited vulnerabilities',
    'is anything security on fire?',
    'security vulnerabilities',
    'CVE updates',
    'actively exploited CVEs',
    'exploited vulnerabilities',
    'KEV additions',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'AZN.L yearly graph'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('cisaKevRecentTemplate metadata', () => {
  it('uses public source policy and hourly refresh', () => {
    expect(cisaKevRecentTemplate.paramKeys).toEqual([]);
    expect(cisaKevRecentTemplate.rightsStatus).toBe('public');
    expect(cisaKevRecentTemplate.defaultRefreshSeconds).toBe(3600);
  });
});
