import { describe, expect, it } from 'vitest';
import { weatherCardData } from './weather-card';
import { currentPoint, makeWeatherSignal as make, twelveHourForecast } from './test-support';

describe('weatherCardData advice variants', () => {
  it('prioritises umbrella warning when rain >= 50% and precipitation > 0', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 12, '°C'),
        currentPoint('feels_like', 12, '°C'),
        currentPoint('precipitation', 0.2, 'mm'),
        currentPoint('uv_index', 8),
        currentPoint('is_day', 1),
        ...twelveHourForecast((h) => ({ temp: 12, rainProb: h === 5 ? 80 : 20, code: 61 })),
      ]),
    );
    expect(data?.advice).toMatch(/^Bring an umbrella — 80% rain at /);
  });

  it('skips the umbrella when probability is high but it is not currently raining', () => {
    // Without precipitation > 0 the rain rule does not apply.
    const data = weatherCardData(
      make([
        currentPoint('temperature', 15, '°C'),
        currentPoint('feels_like', 15, '°C'),
        currentPoint('precipitation', 0, 'mm'),
        ...twelveHourForecast(() => ({ temp: 15, rainProb: 70, code: 61 })),
      ]),
    );
    expect(data?.advice).toBe('Pleasant conditions');
  });

  it('warns about cold when apparent temperature is below 5°C', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 6, '°C'),
        currentPoint('feels_like', 2.5, '°C'),
        currentPoint('precipitation', 0, 'mm'),
      ]),
    );
    expect(data?.advice).toBe('Wear a coat — feels like 2.5°C');
  });

  it('warns about heat when apparent temperature is above 28°C', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 30, '°C'),
        currentPoint('feels_like', 32.7, '°C'),
        currentPoint('precipitation', 0, 'mm'),
      ]),
    );
    expect(data?.advice).toBe('Stay cool — feels like 32.7°C');
  });

  it('warns about UV when index >= 7 during the day', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 22, '°C'),
        currentPoint('feels_like', 22, '°C'),
        currentPoint('precipitation', 0, 'mm'),
        currentPoint('uv_index', 8.1),
        currentPoint('is_day', 1),
      ]),
    );
    expect(data?.advice).toBe('High UV — sunscreen if outside');
  });

  it('does not warn about UV at night even when the index is reported', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 20, '°C'),
        currentPoint('feels_like', 20, '°C'),
        currentPoint('precipitation', 0, 'mm'),
        currentPoint('uv_index', 8.5),
        currentPoint('is_day', 0),
      ]),
    );
    expect(data?.advice).toBe('Pleasant conditions');
  });

  it('falls back to "Pleasant conditions" when nothing crosses a threshold', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 19, '°C'),
        currentPoint('feels_like', 19, '°C'),
        currentPoint('precipitation', 0, 'mm'),
        currentPoint('uv_index', 3),
        currentPoint('is_day', 1),
      ]),
    );
    expect(data?.advice).toBe('Pleasant conditions');
  });
});
