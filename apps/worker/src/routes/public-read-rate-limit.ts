import type { Context, MiddlewareHandler } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { nextBucket, type Bucket, type RateLimitHit } from '../do/rate-limiter';

// Env binding name for the Durable Object namespace. When present, counts are
// enforced globally via the DO; otherwise the limiter falls back to the
// per-isolate in-memory Map (used by local dev and unit tests).
const RATE_LIMITER_BINDING = 'RATE_LIMITER';

type Options = {
  readonly maxRequests?: number;
  readonly windowMs?: number;
  readonly maxBuckets?: number;
  readonly now?: () => number;
  readonly store?: Map<string, Bucket>;
  readonly bucketPrefix?: string;
  readonly namespaceBinding?: string;
  readonly shouldLimit?: (c: Context) => boolean;
  readonly keyForRequest?: (c: Context) => string;
};

// A backend records one hit for `key` and returns the post-increment count and
// window reset. In-memory is synchronous; the DO-backed one awaits a subrequest.
type RateLimitBackend = (
  key: string,
  windowMs: number,
  timestamp: number,
) => RateLimitHit | Promise<RateLimitHit>;

const MAX_BUCKETS = 5_000;

const requesterIp = (c: Context): string => {
  const forwarded = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For');
  return forwarded?.split(',')[0]?.trim() || c.req.header('X-Real-IP') || 'unknown';
};

const authenticatedUserKey = (c: Context): string => {
  const user = (c as { get: (key: 'user') => unknown }).get('user');
  if (user && typeof user === 'object' && 'id' in user && typeof user.id === 'string') {
    return `user:${user.id}`;
  }
  return `ip:${requesterIp(c)}`;
};

// Each limit is one bucket definition; enforcement below is shared.
const defineRateLimit =
  (bucket: RequiredLimitOptions) =>
  (options: Options = {}): MiddlewareHandler =>
    createAnonymousRateLimit({ ...bucket, ...options });

export const createPublicReadRateLimit = defineRateLimit({
  bucketPrefix: 'public-read',
  maxRequests: 120,
  windowMs: 60_000,
});

export const createPublicReportRateLimit = defineRateLimit({
  bucketPrefix: 'public-report',
  maxRequests: 5,
  windowMs: 10 * 60_000,
});

export const createAuthOAuthStartRateLimit = defineRateLimit({
  bucketPrefix: 'auth-oauth-start',
  maxRequests: 20,
  windowMs: 10 * 60_000,
});

export const createAuthOAuthCallbackRateLimit = defineRateLimit({
  bucketPrefix: 'auth-oauth-callback',
  maxRequests: 60,
  windowMs: 10 * 60_000,
});

// MCP dynamic client registration (POST /api/auth/mcp/register) is anonymous by
// design, so it's keyed per requester IP. Lenient — a real client registers once
// per device — while capping anonymous oauth_application spam.
export const createMcpRegisterRateLimit = defineRateLimit({
  bucketPrefix: 'mcp-register',
  maxRequests: 10,
  windowMs: 10 * 60_000,
});

// Beacon usage-event ingest (POST /api/beacon) is machine-token traffic keyed
// per requester IP. Generous — real apps post one event per user action — while
// capping what a leaked or brute-forced token attempt can write.
export const createBeaconIngestRateLimit = defineRateLimit({
  bucketPrefix: 'beacon-ingest',
  maxRequests: 240,
  windowMs: 60_000,
});

export const createPlanCreateRateLimit = defineRateLimit({
  bucketPrefix: 'plan-create',
  maxRequests: 30,
  windowMs: 10 * 60_000,
  keyForRequest: authenticatedUserKey,
});

const createAnonymousRateLimit = (options: RequiredLimitOptions): MiddlewareHandler => {
  const maxRequests = options.maxRequests;
  const windowMs = options.windowMs;
  const now = options.now ?? Date.now;
  const store = options.store ?? new Map<string, Bucket>();
  const bucketPrefix = options.bucketPrefix;
  const maxBuckets = options.maxBuckets ?? MAX_BUCKETS;
  const namespaceBinding = options.namespaceBinding ?? RATE_LIMITER_BINDING;
  const memoryBackend = createMemoryBackend(store, maxBuckets);

  return async (c, next) => {
    if (options.shouldLimit !== undefined && !options.shouldLimit(c)) return next();

    const timestamp = now();
    const key = requesterKey(c, bucketPrefix, options.keyForRequest);
    const namespace = readNamespace(c, namespaceBinding);
    const backend = namespace ? createDurableObjectBackend(namespace) : memoryBackend;
    const { count, resetAt } = await backend(key, windowMs, timestamp);

    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - timestamp) / 1000));
    setLimitHeaders(c, maxRequests, Math.max(0, maxRequests - count), resetAt);

    if (count > maxRequests) {
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json(
        {
          error: 'rate_limited',
          retry_after_seconds: retryAfterSeconds,
          limit: maxRequests,
          reset_at: Math.ceil(resetAt / 1000),
        },
        429 satisfies StatusCode,
      );
    }

    return next();
  };
};

// In-memory per-isolate counter: the fallback for local dev and unit tests,
// where no Durable Object namespace is bound.
const createMemoryBackend = (store: Map<string, Bucket>, maxBuckets: number): RateLimitBackend => {
  return (key, windowMs, timestamp) => {
    const bucket = nextBucket(store.get(key), timestamp, windowMs);
    bucket.count += 1;
    store.set(key, bucket);
    if (store.size > maxBuckets) {
      pruneExpiredBuckets(store, timestamp);
      pruneOldestBuckets(store, maxBuckets);
    }
    return { count: bucket.count, resetAt: bucket.resetAt };
  };
};

// DO-backed counter: one instance per key holds the authoritative bucket.
const createDurableObjectBackend = (namespace: DurableObjectNamespace): RateLimitBackend => {
  return async (key, windowMs, timestamp) => {
    const stub = namespace.get(namespace.idFromName(key));
    const response = await stub.fetch('https://rate-limiter/hit', {
      method: 'POST',
      body: JSON.stringify({ windowMs, now: timestamp }),
    });
    return await response.json<RateLimitHit>();
  };
};

const readNamespace = (c: Context, binding: string): DurableObjectNamespace | null => {
  const env = c.env as Record<string, unknown> | undefined;
  const candidate = env?.[binding];
  return isDurableObjectNamespace(candidate) ? candidate : null;
};

const isDurableObjectNamespace = (value: unknown): value is DurableObjectNamespace =>
  typeof value === 'object' &&
  value !== null &&
  'idFromName' in value &&
  typeof value.idFromName === 'function';

type RequiredLimitOptions = Options & {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly bucketPrefix: string;
};

const requesterKey = (
  c: Context,
  bucketPrefix: string,
  keyForRequest: ((c: Context) => string) | undefined,
): string => {
  const requester = keyForRequest?.(c) ?? requesterIp(c);
  return `${bucketPrefix}:${requester}`;
};

const setLimitHeaders = (c: Context, limit: number, remaining: number, resetAt: number): void => {
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
};

const pruneExpiredBuckets = (store: Map<string, Bucket>, timestamp: number): void => {
  for (const [key, bucket] of store) {
    if (timestamp >= bucket.resetAt) store.delete(key);
  }
};

const pruneOldestBuckets = (store: Map<string, Bucket>, maxBuckets: number): void => {
  while (store.size > maxBuckets) {
    let oldestKey: string | null = null;
    let oldestResetAt = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of store) {
      if (bucket.resetAt < oldestResetAt) {
        oldestKey = key;
        oldestResetAt = bucket.resetAt;
      }
    }
    if (oldestKey === null) return;
    store.delete(oldestKey);
  }
};
