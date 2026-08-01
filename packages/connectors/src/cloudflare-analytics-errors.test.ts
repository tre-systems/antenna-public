import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseConfig, gqlResponse } from './cloudflare-analytics-test-fixtures';
import { cloudflareAnalytics } from './cloudflare-analytics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cloudflareAnalytics errors', () => {
  it('surfaces GraphQL permission errors as unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          gqlResponse({ errors: [{ message: 'insufficient permissions' }], data: null }),
        ),
    );

    const result = await cloudflareAnalytics(baseConfig);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unauthorized');
  });

  it.each([
    [403, 'unauthorized'],
    [429, 'rate_limited'],
    [500, 'fetch_failed'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status })));

    const result = await cloudflareAnalytics(baseConfig);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });
});
