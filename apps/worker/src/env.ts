import type { MiddlewareEnv } from './auth/middleware';
import type { DispatchEnv } from './cron/dispatch/types';
import type { BeaconEnv } from './routes/beacon';

// Compose every deployed binding in one type.
export type WorkerEnv = MiddlewareEnv &
  DispatchEnv &
  BeaconEnv & {
    readonly ASSETS: Fetcher;
    readonly CHANNELS: DurableObjectNamespace;
    readonly RATE_LIMITER: DurableObjectNamespace;
    readonly SENTRY_DSN?: string;
    readonly SENTRY_ENVIRONMENT?: string;
    readonly SENTRY_RELEASE?: string;
    readonly SENTRY_TRACES_SAMPLE_RATE?: string;
  };
