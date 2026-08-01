import type { ApiError } from '@antenna/shared';

// Keep cross-isolate buckets in one in-memory Durable Object per key.

export type Bucket = {
  count: number;
  resetAt: number;
};

export const nextBucket = (
  bucket: Bucket | undefined,
  timestamp: number,
  windowMs: number,
): Bucket => {
  if (!bucket || timestamp >= bucket.resetAt) {
    return { count: 0, resetAt: timestamp + windowMs };
  }
  return bucket;
};

type HitRequest = {
  readonly windowMs: number;
  readonly now: number;
};

export type RateLimitHit = {
  readonly count: number;
  readonly resetAt: number;
};

export class RateLimiter implements DurableObject {
  private bucket: Bucket | undefined;

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const body: unknown = await request.json().catch(() => null);
    if (!isHitRequest(body)) {
      return Response.json({ error: 'invalid_request' } satisfies ApiError, { status: 400 });
    }
    const { windowMs, now } = body;
    this.bucket = nextBucket(this.bucket, now, windowMs);
    this.bucket.count += 1;
    return Response.json({
      count: this.bucket.count,
      resetAt: this.bucket.resetAt,
    } satisfies RateLimitHit);
  }
}

const isHitRequest = (value: unknown): value is HitRequest =>
  value !== null &&
  typeof value === 'object' &&
  'windowMs' in value &&
  typeof value.windowMs === 'number' &&
  Number.isFinite(value.windowMs) &&
  value.windowMs > 0 &&
  'now' in value &&
  typeof value.now === 'number' &&
  Number.isFinite(value.now);
