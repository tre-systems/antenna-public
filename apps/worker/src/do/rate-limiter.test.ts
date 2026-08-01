import { describe, expect, it } from 'vitest';
import { RateLimiter, nextBucket } from './rate-limiter';

const makeLimiter = (): RateLimiter => new RateLimiter({} as DurableObjectState, {});

describe('nextBucket', () => {
  it('keeps an active bucket and resets an expired bucket', () => {
    const active = { count: 2, resetAt: 200 };
    expect(nextBucket(active, 100, 50)).toBe(active);
    expect(nextBucket(active, 200, 50)).toEqual({ count: 0, resetAt: 250 });
  });
});

describe('RateLimiter.fetch', () => {
  it.each([null, {}, { windowMs: 0, now: 1 }, { windowMs: 1, now: Number.POSITIVE_INFINITY }])(
    'rejects an invalid internal request',
    async (body) => {
      const response = await makeLimiter().fetch(
        new Request('https://do/hit', { method: 'POST', body: JSON.stringify(body) }),
      );

      expect(response.status).toBe(400);
    },
  );

  it('increments a valid bucket', async () => {
    const limiter = makeLimiter();
    const request = (): Request =>
      new Request('https://do/hit', {
        method: 'POST',
        body: JSON.stringify({ windowMs: 1_000, now: 100 }),
      });

    expect(await (await limiter.fetch(request())).json()).toEqual({ count: 1, resetAt: 1_100 });
    expect(await (await limiter.fetch(request())).json()).toEqual({ count: 2, resetAt: 1_100 });
  });
});
