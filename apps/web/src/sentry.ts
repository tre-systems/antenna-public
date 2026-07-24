import { init } from '@sentry/browser';

type BrowserEnv = {
  readonly MODE: string;
  readonly PROD: boolean;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
};

type SanitizableEvent = {
  request?: {
    url?: string;
    query_string?: string | Record<string, unknown>;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    data?: unknown;
  };
  extra?: Record<string, unknown>;
};

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

type BeforeSend = NonNullable<NonNullable<Parameters<typeof init>[0]>['beforeSend']>;

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

const env = import.meta.env as BrowserEnv;
const dsn = env.VITE_SENTRY_DSN;

function redactHeaders(headers: Record<string, string> | undefined) {
  if (!headers) {
    return headers;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('authorization') || lowerKey.includes('cookie')) {
        return [key, '[Filtered]'];
      }
      return [key, value];
    }),
  );
}

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

if (dsn) {
  init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT ?? env.MODE,
    release: env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: env.PROD ? 0.01 : 0,
    beforeSend,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
