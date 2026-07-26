import { describe, expect, it } from 'vitest';
import { forecastHourLabel } from './weather-forecast';

describe('forecastHourLabel', () => {
  // Pin the local hour so the label is deterministic in any runner timezone.
  const hourAt = (localHour: number, hourOffset = 1) => {
    const d = new Date();
    d.setHours(localHour, 0, 0, 0);
    return {
      hourOffset,
      ts: d.getTime(),
      condition: 'clear' as const,
      temp: 20,
      rainProb: null,
      code: null,
    };
  };

  it('formats midnight as 12a and noon as 12p', () => {
    expect(forecastHourLabel(hourAt(0))).toBe('12a');
    expect(forecastHourLabel(hourAt(12))).toBe('12p');
  });

  it('formats morning hours with an "a" suffix and afternoon hours with "p"', () => {
    expect(forecastHourLabel(hourAt(9))).toBe('9a');
    expect(forecastHourLabel(hourAt(17))).toBe('5p');
    expect(forecastHourLabel(hourAt(23))).toBe('11p');
  });

  it('falls back to +Nh when the timestamp is missing', () => {
    expect(
      forecastHourLabel({
        hourOffset: 4,
        ts: 0,
        condition: 'clear',
        temp: 10,
        rainProb: null,
        code: null,
      }),
    ).toBe('+4h');
  });
});
