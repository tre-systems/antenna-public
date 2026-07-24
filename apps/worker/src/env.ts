import type { MiddlewareEnv } from './auth/middleware';
import type { DigestEnv } from './cron/digest/types';
import type { DispatchEnv } from './cron/dispatch/types';
import type { BeaconEnv } from './routes/beacon';

// The full set of bindings the deployed Worker holds, composed once. Adding a
// secret or binding should touch this type only — domain modules keep their own
// narrower env types (DbEnv, AuthEnv, DispatchEnv, DigestEnv) and WorkerEnv
// unions them with the runtime-only bindings (Static Assets + Durable Objects).
// CHANNELS is required here even though NotifyEnv treats it as optional: the
// deployed Worker always binds it.
export type WorkerEnv = MiddlewareEnv &
  DispatchEnv &
  DigestEnv &
  BeaconEnv & {
    readonly ASSETS: Fetcher;
    readonly CHANNELS: DurableObjectNamespace;
    readonly RATE_LIMITER: DurableObjectNamespace;
    readonly SENTRY_DSN?: string;
    readonly SENTRY_ENVIRONMENT?: string;
    readonly SENTRY_RELEASE?: string;
    readonly SENTRY_TRACES_SAMPLE_RATE?: string;
  };
