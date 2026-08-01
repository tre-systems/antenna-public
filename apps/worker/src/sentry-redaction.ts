import type { CloudflareOptions } from '@sentry/cloudflare';

type BeforeSend = NonNullable<CloudflareOptions['beforeSend']>;

// Describe the writable Sentry fields stripped before events leave the Worker.
type SanitizableEvent = {
  type?: undefined;
  request?: {
    url?: string;
    query_string?: string | Record<string, unknown>;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    data?: unknown;
  };
  extra?: Record<string, unknown>;
};

const SENSITIVE_EXTRA_KEYS = [
  'apiKey',
  'authorization',
  'collection',
  'cookie',
  'dataPoint',
  'digest',
  'prompt',
  'requestBody',
  'response',
  'signal',
  'sourcePayload',
  'text',
  'token',
];

// Remove collection slugs and query strings because they identify shared content.
const sanitizeRequestUrl = (value: string | undefined): string | undefined => {
  if (!value) return value;
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname
      .replace(/^\/c\/[^/]+/, '/c/[Filtered]')
      .replace(/^\/api\/(shared|public)\/collections\/[^/]+/, '/api/$1/collections/[Filtered]');
    return url.toString();
  } catch {
    return value.split('?')[0];
  }
};

const redactHeaders = (headers: Record<string, string> | undefined) => {
  if (!headers) return headers;

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('authorization') || lowerKey.includes('cookie')) {
        return [key, '[Filtered]'];
      }
      return [key, value];
    }),
  );
};

export const beforeSend: BeforeSend = (event, _hint) => {
  const sanitizableEvent = event as SanitizableEvent;

  if (sanitizableEvent.request) {
    sanitizableEvent.request.url = sanitizeRequestUrl(sanitizableEvent.request.url);
    delete sanitizableEvent.request.query_string;
    const headers = redactHeaders(sanitizableEvent.request.headers);
    if (headers) {
      sanitizableEvent.request.headers = headers;
    } else {
      delete sanitizableEvent.request.headers;
    }
    delete sanitizableEvent.request.cookies;
    delete sanitizableEvent.request.data;
  }

  if (sanitizableEvent.extra) {
    for (const key of SENSITIVE_EXTRA_KEYS) {
      if (key in sanitizableEvent.extra) {
        sanitizableEvent.extra[key] = '[Filtered]';
      }
    }
  }

  return event;
};
