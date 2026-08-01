import { describe, expect, it } from 'vitest';
import { cloudflareAnalyticsTemplate } from './cloudflare-analytics';

const anyHintMatches = (prompt: string): boolean =>
  cloudflareAnalyticsTemplate.matchHints.some((rx) => rx.test(prompt));

describe('cloudflareAnalyticsTemplate.matchHints', () => {
  it.each([
    'cloudflare traffic',
    'cloudflare analytics',
    'worker requests',
    'workers analytics',
    'app fleet',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in London', 'app usage for antenna', 'github trending'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('cloudflareAnalyticsTemplate metadata', () => {
  it('is requires-auth with a server-injected analytics token', () => {
    expect(cloudflareAnalyticsTemplate.paramKeys).toEqual(['account_id']);
    expect(cloudflareAnalyticsTemplate.rightsStatus).toBe('requires-auth');
    expect(cloudflareAnalyticsTemplate.serverSecret?.env).toBe('CF_ANALYTICS_API_TOKEN');
  });

  it('accepts a Worker script filter and rejects malformed config', () => {
    expect(
      cloudflareAnalyticsTemplate.configSchema.safeParse({
        account_id: 'f'.repeat(32),
        days: 7,
        script: 'sample-worker',
      }).success,
    ).toBe(true);
    expect(
      cloudflareAnalyticsTemplate.configSchema.safeParse({ account_id: 'short' }).success,
    ).toBe(false);
    expect(
      cloudflareAnalyticsTemplate.configSchema.safeParse({ account_id: 'f'.repeat(32), days: 99 })
        .success,
    ).toBe(false);
    expect(
      cloudflareAnalyticsTemplate.configSchema.safeParse({
        account_id: 'f'.repeat(32),
        script: 'bad script',
      }).success,
    ).toBe(false);
  });
});
