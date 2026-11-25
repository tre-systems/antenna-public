import { describe, expect, it } from 'vitest';
import { beforeSend } from './sentry-redaction';

describe('Sentry exception redaction', () => {
  const bearer = 'synthetic-oauth-bearer';
  const queryFailure = `Failed query: select * from oauth_access_token where access_token = ?\nparams: ${bearer},false`;

  it('filters Drizzle failures throughout linked exceptions without losing stack locations', async () => {
    const event = await beforeSend(
      {
        type: undefined,
        message: queryFailure,
        exception: {
          values: [
            { type: 'Error', value: 'D1_ERROR: internal error; reference = synthetic-reference' },
            {
              type: 'DrizzleQueryError',
              value: queryFailure,
              mechanism: { type: 'chained', handled: true },
              stacktrace: {
                frames: [{ filename: 'index.js', lineno: 42, colno: 7, vars: { token: bearer } }],
              },
            },
          ],
        },
        debug_meta: {
          images: [{ type: 'sourcemap', code_file: 'index.js', debug_id: 'synthetic-debug-id' }],
        },
      },
      {},
    );

    expect(JSON.stringify(event)).not.toContain(bearer);
    expect(event?.message).toBe('Database query failed [Filtered]');
    expect(event?.exception?.values?.[0]?.value).toContain('D1_ERROR: internal error');
    expect(event?.exception?.values?.[1]?.stacktrace?.frames?.[0]).toEqual({
      filename: 'index.js',
      lineno: 42,
      colno: 7,
    });
    expect(event?.exception?.values?.[1]?.mechanism).toEqual({ type: 'chained', handled: true });
    expect(event?.debug_meta?.images?.[0]?.debug_id).toBe('synthetic-debug-id');
  });

  it('filters serialized query bindings, nested credentials and interpolated log parameters', async () => {
    const input = {
      type: undefined,
      logentry: { message: 'query failed', formatted: queryFailure, params: [bearer] },
      extra: {
        retryable: true,
        __serialized__: {
          query: 'select a private literal',
          params: [bearer],
          cause: {
            message: queryFailure,
            accessToken: bearer,
            nested: [{ Authorization: bearer }],
          },
        },
      },
    };
    const event = await beforeSend(input, {});

    expect(JSON.stringify(event)).not.toContain(bearer);
    expect(JSON.stringify(event)).not.toContain('private literal');
    expect(event?.extra?.retryable).toBe(true);
    expect(event?.logentry).not.toHaveProperty('params');
  });

  it('filters multiline binding suffixes and retains ordinary diagnostics', async () => {
    const event = await beforeSend(
      {
        type: undefined,
        exception: {
          values: [
            { value: `D1 request failed\nParameters: ${bearer}\nother-private-value` },
            { value: 'Network connection lost' },
          ],
        },
      },
      {},
    );
    expect(event?.exception?.values?.[0]?.value).toBe('D1 request failed\nparams: [Filtered]');
    expect(event?.exception?.values?.[1]?.value).toBe('Network connection lost');
  });
});
