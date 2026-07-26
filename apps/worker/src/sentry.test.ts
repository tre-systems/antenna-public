import { describe, expect, it } from 'vitest';
import type { WorkerEnv } from './env';
import { beforeSend } from './sentry-redaction';
import {
  beforeBreadcrumb,
  beforeSendSpan,
  beforeSendTransaction,
  isLowValueD1TransactionName,
  normalizeTransactionName,
  sentryOptions,
} from './sentry';

type TestTransaction = {
  readonly transaction?: string;
  readonly transaction_info?: unknown;
  readonly spans?: ReadonlyArray<{ readonly description?: string }>;
};

const env = (overrides: Partial<WorkerEnv> = {}): WorkerEnv =>
  ({
    SENTRY_DSN: 'https://public@example.test/1',
    SENTRY_ENVIRONMENT: 'production',
    ...overrides,
  }) as WorkerEnv;

describe('worker Sentry telemetry policy', () => {
  it('normalizes scheduled and D1 transaction names', () => {
    expect(normalizeTransactionName('Scheduled Cron * * * * *')).toBe('Scheduled cron tick');
    expect(
      normalizeTransactionName(
        'insert into "signal_points" ("id", "signal_id") values (?, ?) on conflict do update',
      ),
    ).toBe('D1 insert signal_points');
    expect(normalizeTransactionName('  SELECT *   FROM signal_status WHERE signal_id = ?')).toBe(
      'D1 select signal_status',
    );
  });

  it('identifies high-volume signal write queries as low-value root transactions', () => {
    expect(isLowValueD1TransactionName('insert into signal_points values (?, ?)')).toBe(true);
    expect(isLowValueD1TransactionName('update "signal_status" set status = ?')).toBe(true);
    expect(isLowValueD1TransactionName('select * from signal_points')).toBe(false);
    expect(isLowValueD1TransactionName('insert into collections values (?)')).toBe(false);
  });

  it('drops low-value D1 transaction events without dropping error events', async () => {
    expect(
      await beforeSendTransaction(
        {
          type: 'transaction',
          transaction: 'insert into signal_points values (?, ?)',
        },
        {},
      ),
    ).toBeNull();

    const error = beforeSend(
      {
        type: undefined,
        message: 'adapter failed',
        extra: { token: 'secret', retryable: true },
      },
      {},
    );

    expect(error).toMatchObject({
      message: 'adapter failed',
      extra: { token: '[Filtered]', retryable: true },
    });
  });

  it('removes query secrets and shared-link capabilities from request telemetry', async () => {
    const event = await beforeSend(
      {
        type: undefined,
        request: {
          url: 'https://antenna.example/c/share-secret?code=oauth-code&state=oauth-state',
          query_string: { code: 'oauth-code' },
        },
      },
      {},
    );

    expect(event?.request?.url).toBe('https://antenna.example/c/[Filtered]');
    expect(event?.request).not.toHaveProperty('query_string');
  });

  it('renames cron transaction events and raw D1 child spans', async () => {
    const transaction = (await beforeSendTransaction(
      {
        type: 'transaction',
        transaction: 'Scheduled Cron * * * * *',
        spans: [
          {
            trace_id: 'trace',
            span_id: 'span',
            start_timestamp: 1,
            timestamp: 2,
            op: 'db.query',
            description: 'select * from signal_points where signal_id = ?',
            data: {},
          },
        ],
      },
      {},
    )) as TestTransaction | null;

    expect(transaction?.transaction).toBe('Scheduled cron tick');
    expect(transaction?.transaction_info).toEqual({ source: 'custom' });
    expect(transaction?.spans?.[0]?.description).toBe('D1 select signal_points');
  });

  it('normalizes D1 spans and breadcrumbs before export', () => {
    const span = beforeSendSpan({
      trace_id: 'trace',
      span_id: 'span',
      start_timestamp: 1,
      timestamp: 2,
      op: 'db.query',
      description: 'insert into signal_status values (?, ?)',
      data: { 'db.statement': 'secret parameter' },
    });
    expect(span.description).toBe('D1 insert signal_status');
    expect(span.data).toEqual({});

    expect(
      beforeBreadcrumb({
        category: 'query',
        message: 'insert into signal_points values (?, ?)',
      })?.message,
    ).toBe('D1 insert signal_points');
  });

  it('uses conservative production trace sampling with an override', () => {
    expect(sentryOptions(env())?.tracesSampleRate).toBe(0.002);
    expect(sentryOptions(env({ SENTRY_ENVIRONMENT: undefined }))?.tracesSampleRate).toBe(0.002);
    expect(sentryOptions(env({ SENTRY_TRACES_SAMPLE_RATE: '0.25' }))?.tracesSampleRate).toBe(0.25);
    expect(sentryOptions(env({ SENTRY_ENVIRONMENT: 'preview' }))?.tracesSampleRate).toBe(0);
  });
});
