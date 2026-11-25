import { describe, expect, it } from 'vitest';
import { beforeBreadcrumb, beforeSend, beforeSendSpan, beforeSendTransaction } from './sentry';

describe('browser Sentry privacy', () => {
  it('scrubs navigation/fetch breadcrumbs and all trace hooks', async () => {
    const crumb = beforeBreadcrumb(
      {
        category: 'navigation',
        data: {
          from: '/c/shared-secret',
          to: '/api/auth/callback?code=oauth-secret',
        },
      },
      {},
    );
    const event = await beforeSend(
      {
        type: undefined,
        breadcrumbs: crumb ? [crumb] : [],
        extra: { nested: { apiKey: 'key-secret' } },
      },
      {},
    );
    const span = beforeSendSpan({
      trace_id: 'trace',
      span_id: 'span',
      start_timestamp: 1,
      data: { 'http.url': 'https://api.test/?c=key-secret' },
    });
    const transaction = await beforeSendTransaction(
      { type: 'transaction', spans: [span], transaction: 'GET /c/shared-secret' },
      {},
    );
    expect(JSON.stringify([crumb, event, span, transaction])).not.toMatch(
      /shared-secret|oauth-secret|key-secret/,
    );
  });
  it('removes OAuth queries and shared-link capabilities', async () => {
    const event = await beforeSend(
      {
        type: undefined,
        request: {
          url: 'https://antenna.example/api/shared/collections/share-secret?code=oauth-code',
          query_string: { code: 'oauth-code' },
        },
      },
      {},
    );

    expect(event?.request?.url).toBe('https://antenna.example/api/shared/collections/[Filtered]');
    expect(event?.request).not.toHaveProperty('query_string');
  });
});
