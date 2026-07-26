import { describe, expect, it } from 'vitest';
import { compactNumber, formatValue, pointValueText } from './value';

describe('formatValue', () => {
  it('renders integers without decimals — "0", not "0.00"', () => {
    expect(formatValue(0)).toBe('0');
    expect(formatValue(3)).toBe('3');
    expect(formatValue(1234)).toBe('1,234');
  });

  it('renders fractional values with exactly 2 decimals', () => {
    // 2 decimals everywhere so the hero number matches the chips and percents around it.
    expect(formatValue(1.2345)).toBe('1.23');
    expect(formatValue(99.9)).toBe('99.90');
    expect(formatValue(2106.16)).toBe('2,106.16');
  });

  it('still groups thousands and keeps integers integer when ≥ 1000', () => {
    expect(formatValue(76612)).toBe('76,612');
  });

  it('passes strings through unchanged', () => {
    expect(formatValue('No upcoming events')).toBe('No upcoming events');
  });

  it('uses value_text for Worker text points', () => {
    expect(
      pointValueText({
        dimensions: { metric: 'next_event' },
        value: null,
        value_text: 'PBOC LPR Decision',
      }),
    ).toBe('PBOC LPR Decision');
  });
});

describe('compactNumber', () => {
  it('shortens to k / M / B', () => {
    expect(compactNumber(500)).toBe('500');
    expect(compactNumber(2_500)).toBe('3k');
    expect(compactNumber(49_009_400)).toBe('49M');
    expect(compactNumber(143_066_500)).toBe('143M');
    expect(compactNumber(2_500_000_000)).toBe('2.5B');
  });

  it('returns em-dash for non-numbers and non-finite values', () => {
    expect(compactNumber(undefined)).toBe('—');
    expect(compactNumber(null)).toBe('—');
    expect(compactNumber('not a number')).toBe('—');
    expect(compactNumber(Number.NaN)).toBe('—');
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
