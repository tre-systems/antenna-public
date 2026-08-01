import { describe, expect, it } from 'vitest';
import { cloudflareWebAnalyticsTemplate } from './cloudflare-web-analytics';

describe('cloudflareWebAnalyticsTemplate', () => {
  it('is private, server-keyed, and excluded from prompt matching', () => {
    expect(cloudflareWebAnalyticsTemplate.plannerEnabled).toBe(false);
    expect(
      cloudflareWebAnalyticsTemplate.matchHints.some((hint) => hint.test('web analytics')),
    ).toBe(true);
    expect(cloudflareWebAnalyticsTemplate.serverSecret?.env).toBe('CF_ANALYTICS_API_TOKEN');
    expect(
      cloudflareWebAnalyticsTemplate.configSchema.safeParse({
        account_id: 'a'.repeat(32),
        hosts: 'example.com,app.example.com',
        days: 7,
      }).success,
    ).toBe(true);
    expect(
      cloudflareWebAnalyticsTemplate.configSchema.safeParse({
        account_id: 'not-an-account',
        hosts: 'example.com',
      }).success,
    ).toBe(false);
  });
});
