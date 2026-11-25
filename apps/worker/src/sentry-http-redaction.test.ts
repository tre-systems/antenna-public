import { expect, it } from 'vitest';
import { beforeSend } from './sentry-redaction';
import { beforeBreadcrumb, beforeSendSpan, beforeSendTransaction } from './sentry';

it('scrubs fetch breadcrumbs in error events independently of trace sampling', async () => {
  const breadcrumb = beforeBreadcrumb({
    category: 'fetch',
    data: {
      url: 'https://api.tradingeconomics.com/markets/historical/TEST?c=synthetic-secret',
    },
  });
  const event = await beforeSend(
    { type: undefined, breadcrumbs: breadcrumb ? [breadcrumb] : [] },
    {},
  );
  expect(JSON.stringify(event)).not.toContain('synthetic-secret');
  expect(event?.breadcrumbs?.[0]?.data?.url).toBe(
    'https://api.tradingeconomics.com/markets/historical/TEST',
  );
});

it('scrubs transactions, root trace attributes and child HTTP spans', async () => {
  const span = beforeSendSpan({
    trace_id: 'trace',
    span_id: 'span',
    start_timestamp: 1,
    op: 'http.client',
    data: { 'http.url': 'https://api.test/path?c=synthetic-secret' },
  });
  const event = await beforeSendTransaction(
    {
      type: 'transaction',
      transaction: 'GET /c/shared-capability',
      request: { url: 'https://antenna.test/api/auth/callback/google?code=synthetic-secret' },
      contexts: {
        trace: {
          trace_id: 'trace',
          span_id: 'span',
          data: { 'url.query': '?code=synthetic-secret' },
        },
      },
      spans: [span],
    },
    {},
  );
  expect(JSON.stringify(event)).not.toMatch(/synthetic-secret|shared-capability/);
  expect(event?.transaction).toBe('GET /c/[Filtered]');
  expect(span.data['http.url']).toBe('https://api.test/path');
});
