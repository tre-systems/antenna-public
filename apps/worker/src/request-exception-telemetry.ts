import * as Sentry from '@sentry/cloudflare';

interface RequestExceptionContext {
  readonly method: string;
  readonly path: string;
  readonly routePath?: string;
}

export interface RequestExceptionDescriptor {
  readonly errorType: string;
  readonly fingerprint: string;
  readonly method: string;
  readonly route: string;
}

const normalizeSegment = (segment: string): string => {
  if (/^\d+$/.test(segment)) return ':id';
  if (/^[a-f0-9]{16,}$/i.test(segment)) return ':id';
  if (/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(segment)) return ':id';
  return segment.length > 32 ? ':id' : segment;
};

const normalizeFallbackRoute = (path: string): string => {
  const pathname = path.split(/[?#]/, 1)[0] ?? '/';
  const protectedPath = pathname
    .replace(/^\/c\/[^/]+/, '/c/:slug')
    .replace(/^\/api\/(shared|public)\/collections\/[^/]+/, '/api/$1/collections/:slug');
  const segments = protectedPath.split('/').map(normalizeSegment);
  return segments.join('/').slice(0, 160) || '/';
};

const normalizeErrorType = (error: Error): string => {
  const name = error.name.replace(/[^a-z0-9_.-]/gi, '').slice(0, 64);
  return name || 'Error';
};

export const describeRequestException = (
  error: Error,
  context: RequestExceptionContext,
): RequestExceptionDescriptor => {
  const method = context.method.toUpperCase().slice(0, 12);
  const route =
    context.routePath && context.routePath !== '/*'
      ? context.routePath
      : normalizeFallbackRoute(context.path);
  const errorType = normalizeErrorType(error);
  return {
    errorType,
    fingerprint: `request:${method}:${route}:${errorType}`,
    method,
    route,
  };
};

export const reportRequestException = (error: Error, context: RequestExceptionContext): void => {
  const descriptor = describeRequestException(error, context);
  Sentry.withScope((scope) => {
    scope.setTag('http.method', descriptor.method);
    scope.setTag('http.route', descriptor.route);
    scope.setTag('error.type', descriptor.errorType);
    scope.setFingerprint([
      'antenna-request-exception',
      descriptor.method,
      descriptor.route,
      descriptor.errorType,
    ]);
    Sentry.captureException(error);
  });
  console.error(JSON.stringify({ event: 'request_exception', ...descriptor }));
};
