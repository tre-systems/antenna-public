import { describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/cloudflare';
import { describeRequestException, reportRequestException } from './request-exception-telemetry';

vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({
      setFingerprint: vi.fn(),
      setTag: vi.fn(),
    });
  }),
}));

describe('request exception telemetry', () => {
  it('uses the registered route and stable error type for its fingerprint', () => {
    const descriptor = describeRequestException(new TypeError('private detail'), {
      method: 'get',
      path: '/api/signals/private-signal-id',
      routePath: '/api/signals/:id',
    });

    expect(descriptor).toEqual({
      errorType: 'TypeError',
      fingerprint: 'request:GET:/api/signals/:id:TypeError',
      method: 'GET',
      route: '/api/signals/:id',
    });
  });

  it('filters capabilities and identifiers from fallback routes', () => {
    expect(
      describeRequestException(new Error('private detail'), {
        method: 'GET',
        path: '/api/public/collections/private-capability/history/12345?token=secret',
      }).route,
    ).toBe('/api/public/collections/:slug/history/:id');
    expect(
      describeRequestException(new Error('private detail'), {
        method: 'GET',
        path: '/c/private-capability',
      }).route,
    ).toBe('/c/:slug');
  });

  it('exports only sanitized dimensions to logs and Sentry', () => {
    const error = new Error('private detail');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportRequestException(error, {
      method: 'POST',
      path: '/api/collections/12345',
      routePath: '/api/collections/:id',
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'request_exception',
        errorType: 'Error',
        fingerprint: 'request:POST:/api/collections/:id:Error',
        method: 'POST',
        route: '/api/collections/:id',
      }),
    );
  });
});
