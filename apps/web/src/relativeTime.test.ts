import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = 1_700_000_000_000;

describe('relativeTime', () => {
  it('returns "just now" for sub-minute deltas', () => {
    expect(relativeTime(NOW - 5_000, NOW)).toBe('just now');
  });

  it('returns minutes for sub-hour deltas', () => {
    expect(relativeTime(NOW - 2 * 60_000, NOW)).toBe('2 min ago');
  });

  it('returns hours for sub-day deltas', () => {
    expect(relativeTime(NOW - 60 * 60_000, NOW)).toBe('1 hr ago');
  });

  it('returns days for >= 1 day deltas', () => {
    expect(relativeTime(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe('3 d ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(relativeTime(NOW + 10_000, NOW)).toBe('just now');
  });
});
