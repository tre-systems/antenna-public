import { describe, expect, it } from 'vitest';
import { redactTelemetry } from './telemetry-redaction';

describe('telemetry export privacy', () => {
  it('redacts URL credentials, queries, fragments and capabilities at every depth', () => {
    const event = {
      request: { url: 'https://antenna.test/c/share-secret?code=oauth-secret', data: 'private' },
      transaction: 'GET /api/shared/collections/share-secret',
      contexts: {
        trace: { data: { 'url.query': '?code=oauth-secret', 'http.fragment': 'secret' } },
      },
      breadcrumbs: [
        {
          category: 'navigation',
          data: {
            from: '/c/share-secret?state=oauth-secret',
            to: '/api/auth/callback?code=oauth-secret',
          },
        },
      ],
      spans: [
        {
          data: {
            'http.url': 'https://user:password@api.test/costs?c=api-secret#fragment-secret',
            'http.query': '?c=api-secret',
            headers: { Authorization: 'Bearer header-secret' },
          },
        },
      ],
      extra: { nested: { api_key: 'nested-secret' } },
    };
    const output = redactTelemetry(event);
    expect(JSON.stringify(output)).not.toMatch(
      /share-secret|oauth-secret|api-secret|nested-secret|header-secret|fragment-secret|password/,
    );
    expect(output.request.url).toBe('https://antenna.test/c/[Filtered]');
    expect(output.request).not.toHaveProperty('data');
    expect(output.spans[0]?.data['http.url']).toBe('https://api.test/costs');
    expect(event.request.url).toContain('oauth-secret');
  });

  it('keeps diagnostics and bounds recursive or cyclic metadata', () => {
    const metadata: Record<string, unknown> = { retryable: true };
    metadata.self = metadata;
    expect(() => JSON.stringify(redactTelemetry(metadata))).not.toThrow();
    expect(redactTelemetry({ message: 'Network connection lost', lineno: 42 })).toEqual({
      message: 'Network connection lost',
      lineno: 42,
    });
  });
});
