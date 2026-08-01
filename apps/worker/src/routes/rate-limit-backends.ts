import { nextBucket, type Bucket, type RateLimitHit } from '../do/rate-limiter';

export type RateLimitBackend = (
  key: string,
  windowMs: number,
  timestamp: number,
) => RateLimitHit | Promise<RateLimitHit>;

export const createMemoryRateLimitBackend = (
  store: Map<string, Bucket>,
  maxBuckets: number,
): RateLimitBackend => {
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

export const createDurableRateLimitBackend = (
  namespace: DurableObjectNamespace,
): RateLimitBackend => {
  return async (key, windowMs, timestamp) => {
    const stub = namespace.get(namespace.idFromName(key));
    const response = await stub.fetch('https://rate-limiter/hit', {
      method: 'POST',
      body: JSON.stringify({ windowMs, now: timestamp }),
    });
    const result: unknown = await response.json();
    if (!response.ok || !isRateLimitHit(result)) throw new Error('Invalid rate limiter response');
    return result;
  };
};

export const readRateLimitNamespace = (
  env: unknown,
  binding: string,
): DurableObjectNamespace | null => {
  if (!isRecord(env)) return null;
  const candidate = env[binding];
  return isDurableObjectNamespace(candidate) ? candidate : null;
};

const isRateLimitHit = (value: unknown): value is RateLimitHit =>
  isRecord(value) &&
  typeof value.count === 'number' &&
  Number.isInteger(value.count) &&
  value.count >= 0 &&
  typeof value.resetAt === 'number' &&
  Number.isFinite(value.resetAt);

const isDurableObjectNamespace = (value: unknown): value is DurableObjectNamespace =>
  isRecord(value) && typeof value.idFromName === 'function' && typeof value.get === 'function';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
