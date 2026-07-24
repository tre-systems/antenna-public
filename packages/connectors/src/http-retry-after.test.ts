import { describe, expect, it } from 'vitest';
import { retryAfterSecondsFromHeaders } from './http-retry-after';

describe('retryAfterSecondsFromHeaders', () => {
  it('uses numeric Retry-After seconds', () => {
    expect(retryAfterSecondsFromHeaders(new Headers({ 'retry-after': '90' }), 60)).toBe(90);
  });

  it('uses HTTP-date Retry-After values', () => {
    expect(
      retryAfterSecondsFromHeaders(
        new Headers({ 'retry-after': 'Fri, 22 May 2026 08:10:00 GMT' }),
        60,
        Date.parse('2026-05-22T08:00:00Z'),
      ),
    ).toBe(600);
  });

  it('falls back when Retry-After is absent or invalid', () => {
    expect(retryAfterSecondsFromHeaders(new Headers(), 3600)).toBe(3600);
    expect(retryAfterSecondsFromHeaders(new Headers({ 'retry-after': 'not-a-date' }), 120)).toBe(
      120,
    );
  });
});
