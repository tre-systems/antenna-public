import { describe, expect, it } from 'vitest';
import { cloudflareIncidentsTemplate } from './cloudflare-incidents';

const anyHintMatches = (prompt: string): boolean =>
  cloudflareIncidentsTemplate.matchHints.some((rx) => rx.test(prompt));

describe('cloudflareIncidentsTemplate.matchHints', () => {
  it.each([
    'Cloudflare status',
    'Cloudflare incidents',
    'Cloudflare outage health',
    'Workers status',
    'D1 outage',
    'R2 incident',
    'Workers KV status',
    'is cloudflare ok',
    'cf outage',
    'are workers down',
    'workers kv down',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'security vulnerabilities'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('cloudflareIncidentsTemplate metadata', () => {
  it('requires a source-rights review and uses a fifteen-minute refresh', () => {
    expect(cloudflareIncidentsTemplate.paramKeys).toEqual([]);
    expect(cloudflareIncidentsTemplate.rightsStatus).toBe('needs-review');
    expect(cloudflareIncidentsTemplate.defaultRefreshSeconds).toBe(900);
  });
});
