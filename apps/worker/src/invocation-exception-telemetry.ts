import * as Sentry from '@sentry/cloudflare';
import { describeRequestException } from './request-exception-telemetry';

export type WorkerInvocationSurface = 'fetch' | 'scheduled';

interface WorkerInvocationExceptionContext {
  readonly method: string;
  readonly path: string;
  readonly routePath?: string;
  readonly surface: WorkerInvocationSurface;
}

export interface WorkerInvocationExceptionDescriptor {
  readonly errorType: string;
  readonly fingerprint: string;
  readonly method: string;
  readonly route: string;
  readonly surface: WorkerInvocationSurface;
}

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Non-Error worker invocation failure');

export const describeWorkerInvocationException = (
  error: unknown,
  context: WorkerInvocationExceptionContext,
): WorkerInvocationExceptionDescriptor => {
  const descriptor = describeRequestException(asError(error), context);
  return {
    ...descriptor,
    fingerprint: `invocation:${context.surface}:${descriptor.method}:${descriptor.route}:${descriptor.errorType}`,
    surface: context.surface,
  };
};

export const reportWorkerInvocationException = (
  error: unknown,
  context: WorkerInvocationExceptionContext,
): void => {
  const normalizedError = asError(error);
  const descriptor = describeWorkerInvocationException(normalizedError, context);
  Sentry.withScope((scope) => {
    scope.setTag('worker.surface', descriptor.surface);
    scope.setTag('http.method', descriptor.method);
    scope.setTag('http.route', descriptor.route);
    scope.setTag('error.type', descriptor.errorType);
    scope.setFingerprint(['antenna-worker-invocation', descriptor.fingerprint]);
    Sentry.captureException(normalizedError);
  });
  console.error(JSON.stringify({ event: 'worker_invocation_exception', ...descriptor }));
};
