import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubRetryAfterSeconds } from './github-rate-limit';

afterEach(() => {
  vi.useRealTimers();
});

describe('githubRetryAfterSeconds', () => {
  it('uses Retry-After seconds when present', () => {
    expect(githubRetryAfterSeconds(new Headers({ 'retry-after': '42' }))).toBe(42);
  });

  it('uses Retry-After HTTP dates when present', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T06:00:00Z'));

    expect(
      githubRetryAfterSeconds(new Headers({ 'retry-after': 'Fri, 22 May 2026 06:03:30 GMT' })),
    ).toBe(210);
  });

  it('uses GitHub reset epoch seconds when Retry-After is absent', () => {
    expect(
      githubRetryAfterSeconds(
        new Headers({ 'x-ratelimit-reset': String(Date.parse('2026-05-22T06:10:00Z') / 1000) }),
        Date.parse('2026-05-22T06:03:00Z'),
      ),
    ).toBe(420);
  });

  it('falls back to one hour when no reset metadata is available', () => {
    expect(githubRetryAfterSeconds(new Headers())).toBe(3600);
  });
});
