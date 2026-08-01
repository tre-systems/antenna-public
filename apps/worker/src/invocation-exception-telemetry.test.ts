import { describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/cloudflare';
import {
  describeWorkerInvocationException,
  reportWorkerInvocationException,
} from './invocation-exception-telemetry';

vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({
      setFingerprint: vi.fn(),
      setTag: vi.fn(),
    });
  }),
}));

describe('worker invocation exception telemetry', () => {
  it('classifies an escaped fetch exception by sanitized route and surface', () => {
    expect(
      describeWorkerInvocationException(new TypeError('private detail'), {
        method: 'GET',
        path: '/api/signals/private-identifier',
        routePath: '/api/signals/:id',
        surface: 'fetch',
      }),
    ).toEqual({
      errorType: 'TypeError',
      fingerprint: 'invocation:fetch:GET:/api/signals/:id:TypeError',
      method: 'GET',
      route: '/api/signals/:id',
      surface: 'fetch',
    });
  });

  it('exports a queryable event without error messages or identifiers', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportWorkerInvocationException(new Error('private detail'), {
      method: 'SCHEDULED',
      path: '/cron',
      routePath: 'Scheduled cron tick',
      surface: 'scheduled',
    });

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'worker_invocation_exception',
        errorType: 'Error',
        fingerprint: 'invocation:scheduled:SCHEDULED:Scheduled cron tick:Error',
        method: 'SCHEDULED',
        route: 'Scheduled cron tick',
        surface: 'scheduled',
      }),
    );
  });
});
