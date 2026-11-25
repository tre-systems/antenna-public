import { init } from '@sentry/browser';
import { redactTelemetry } from '@antenna/shared';

type BrowserEnv = {
  readonly MODE: string;
  readonly PROD: boolean;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
};
type Options = NonNullable<Parameters<typeof init>[0]>;
export const beforeSend: NonNullable<Options['beforeSend']> = (event) => redactTelemetry(event);
export const beforeSendTransaction: NonNullable<Options['beforeSendTransaction']> = (event) =>
  redactTelemetry(event);
export const beforeSendSpan: NonNullable<Options['beforeSendSpan']> = (span) =>
  redactTelemetry(span);
export const beforeBreadcrumb: NonNullable<Options['beforeBreadcrumb']> = (breadcrumb) =>
  redactTelemetry(breadcrumb);

const env = import.meta.env as BrowserEnv;
if (env.VITE_SENTRY_DSN) {
  init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT ?? env.MODE,
    release: env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: env.PROD ? 0.01 : 0,
    beforeSend,
    beforeSendTransaction,
    beforeSendSpan,
    beforeBreadcrumb,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
