// Durable Object backing the rate limiter with cross-isolate enforcement.
//
// The middleware's in-memory Map only counts requests within a single Worker
// isolate. On Cloudflare each colo/isolate keeps its own Map, so a caller whose
// requests land on different isolates is handed a fresh budget every time.
// Routing each rate-limit key through `idFromName(key)` funnels every request
// for that key into one globally addressable instance, making its count
// authoritative across isolates.
//
// The bucket lives only in the DO's memory (like CollectionChannel). If the DO
// is evicted after a quiet period the window resets early, but an actively
// abused key keeps its DO warm — an acceptable trade for avoiding a storage
// read+write on every limited request.

export type Bucket = {
  count: number;
  resetAt: number;
};

// Return the live bucket, or start a fresh window once the current one expires.
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

  // The platform calls `new RateLimiter(state, env)`; this limiter keeps its
  // bucket in memory and needs neither.
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_state: DurableObjectState, _env: unknown) {}

  // One atomic increment per request. DO fetch handlers run to completion
  // without interleaving, so read-increment-write needs no extra locking.
  async fetch(request: Request): Promise<Response> {
    const { windowMs, now } = await request.json<HitRequest>();
    this.bucket = nextBucket(this.bucket, now, windowMs);
    this.bucket.count += 1;
    return Response.json({
      count: this.bucket.count,
      resetAt: this.bucket.resetAt,
    } satisfies RateLimitHit);
  }
}
