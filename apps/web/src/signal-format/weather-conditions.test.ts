import { describe, expect, it } from 'vitest';
import { weatherCondition } from './weather-conditions';

describe('weatherCondition', () => {
  it('maps WMO codes into the small condition set', () => {
    expect(weatherCondition(0)).toBe('clear');
    expect(weatherCondition(2)).toBe('partly-cloudy');
    expect(weatherCondition(3)).toBe('cloudy');
    expect(weatherCondition(45)).toBe('fog');
    expect(weatherCondition(53)).toBe('drizzle');
    expect(weatherCondition(63)).toBe('rain');
    expect(weatherCondition(82)).toBe('rain');
    expect(weatherCondition(73)).toBe('snow');
    expect(weatherCondition(96)).toBe('thunderstorm');
    expect(weatherCondition(undefined)).toBe('cloudy');
  });
});
