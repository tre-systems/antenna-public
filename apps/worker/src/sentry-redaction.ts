import type { CloudflareOptions } from '@sentry/cloudflare';
import { redactTelemetry } from '@antenna/shared';

type BeforeSend = NonNullable<CloudflareOptions['beforeSend']>;

export const beforeSend: BeforeSend = (event, _hint) => redactTelemetry(event);
