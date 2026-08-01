import type { Context, MiddlewareHandler } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import type { Bucket } from '../do/rate-limiter';
import {
  createDurableRateLimitBackend,
  createMemoryRateLimitBackend,
  readRateLimitNamespace,
} from './rate-limit-backends';
import { errWith } from './http';

// Fall back to per-isolate buckets when the Durable Object binding is absent.
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

// MCP clients register once per device, so a tight anonymous limit is sufficient.
export const createMcpRegisterRateLimit = defineRateLimit({
  bucketPrefix: 'mcp-register',
  maxRequests: 10,
  windowMs: 10 * 60_000,
});

// Allow normal beacon volume while bounding leaked-token writes.
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
  const memoryBackend = createMemoryRateLimitBackend(store, maxBuckets);

  return async (c, next) => {
    if (options.shouldLimit !== undefined && !options.shouldLimit(c)) return next();

    const timestamp = now();
    const key = requesterKey(c, bucketPrefix, options.keyForRequest);
    const namespace = readRateLimitNamespace(c.env, namespaceBinding);
    const backend = namespace ? createDurableRateLimitBackend(namespace) : memoryBackend;
    const { count, resetAt } = await backend(key, windowMs, timestamp);

    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - timestamp) / 1000));
    setLimitHeaders(c, maxRequests, Math.max(0, maxRequests - count), resetAt);

    if (count > maxRequests) {
      c.header('Retry-After', String(retryAfterSeconds));
      return errWith(
        c,
        'rate_limited',
        {
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
