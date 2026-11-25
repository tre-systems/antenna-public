import { describe, expect, it } from 'vitest';
import { extractDaily, forecastDayLabel } from './weather-daily';
import { NOW, dayPoints, sixDayForecast } from './test-support';

describe('extractDaily', () => {
  it('groups flat daily metrics into ordered forecast days', () => {
    const days = extractDaily(
      sixDayForecast((d) => ({
        tempMax: 20 + d,
        tempMin: 9 + d,
        rainProb: 10 * d,
        code: d < 3 ? 1 : 61,
      })),
    );
    expect(days).toHaveLength(6);
    expect(days.map((d) => d.dayOffset)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(days[0]).toMatchObject({
      dayOffset: 0,
      tempMax: 20,
      tempMin: 9,
      rainProb: 0,
      condition: 'partly-cloudy',
    });
    expect(days[5]).toMatchObject({ tempMax: 25, tempMin: 14, rainProb: 50, condition: 'rain' });
  });

  it('ignores unrelated metrics and drops days missing a temperature range', () => {
    const days = extractDaily([
      { dimensions: { location: 'L', metric: 'temperature' }, value: 12, ts: NOW },
      // Day 1 has no min temp, so the column would render half-empty — dropped.
      ...dayPoints(1, { tempMax: 18, rainProb: 20 }),
      ...dayPoints(2, { tempMax: 17, tempMin: 8, code: 3 }),
    ]);
    expect(days.map((d) => d.dayOffset)).toEqual([2]);
    expect(days[0]?.rainProb).toBeNull();
    expect(days[0]?.condition).toBe('cloudy');
  });

  it('parses string day dimensions as stored in D1 metric keys', () => {
    const days = extractDaily([
      { dimensions: { location: 'L', metric: 'daily_temp_max', day: '3' }, value: 21, ts: NOW },
      { dimensions: { location: 'L', metric: 'daily_temp_min', day: '3' }, value: 12, ts: NOW },
    ]);
    expect(days.map((d) => d.dayOffset)).toEqual([3]);
  });

  it('reads observed_at from server points so day labels resolve', () => {
    const days = extractDaily([
      {
        dimensions: { location: 'L', metric: 'daily_temp_max', day: '1' },
        value: 21,
        observed_at: NOW,
      },
      {
        dimensions: { location: 'L', metric: 'daily_temp_min', day: '1' },
        value: 12,
        observed_at: NOW,
      },
    ]);
    expect(days[0]?.ts).toBe(NOW);
  });
});

describe('forecastDayLabel', () => {
  it('labels the first day Today and later days by weekday', () => {
    const days = extractDaily(sixDayForecast(() => ({ tempMax: 20, tempMin: 9 })));
    expect(days[0] && forecastDayLabel(days[0])).toBe('Today');
    const tomorrow = days[1];
    expect(tomorrow && forecastDayLabel(tomorrow)).toBe(
      new Date(NOW + 86_400_000).toLocaleDateString(undefined, { weekday: 'short' }),
    );
  });

  it('falls back to a +Nd offset when the timestamp is unusable', () => {
    expect(
      forecastDayLabel({
        dayOffset: 2,
        ts: 0,
        condition: 'cloudy',
        tempMax: 20,
        tempMin: 9,
        rainProb: null,
      }),
    ).toBe('+2d');
  });
});
