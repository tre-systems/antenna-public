import { describe, expect, it } from 'vitest';
import { githubSecurityAdvisoriesTemplate } from './github-security-advisories';

const anyHintMatches = (prompt: string): boolean =>
  githubSecurityAdvisoriesTemplate.matchHints.some((rx) => rx.test(prompt));

describe('githubSecurityAdvisoriesTemplate.matchHints', () => {
  it.each([
    'GitHub security advisories',
    'security advisories from GitHub',
    'npm security',
    'npm vulnerabilities',
    'are there any new high severity npm vulns',
    'high critical advisories',
    'supply chain npm security',
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

describe('githubSecurityAdvisoriesTemplate metadata', () => {
  it('requires attribution and uses a six-hour refresh cadence', () => {
    expect(githubSecurityAdvisoriesTemplate.paramKeys).toEqual([]);
    expect(githubSecurityAdvisoriesTemplate.rightsStatus).toBe('with-attribution');
    expect(githubSecurityAdvisoriesTemplate.defaultRefreshSeconds).toBe(21_600);
  });
});
