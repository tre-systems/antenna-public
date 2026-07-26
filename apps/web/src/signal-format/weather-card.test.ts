import { describe, expect, it } from 'vitest';
import { weatherCardData } from './weather-card';
import {
  NOW,
  currentPoint,
  hourPoints,
  makeWeatherSignal as make,
  twelveHourForecast,
} from './test-support';

describe('weatherCardData', () => {
  it('extracts temperature, descriptors, and context fields', () => {
    const data = weatherCardData(
      make([
        {
          dimensions: { location: 'London', metric: 'temperature' },
          value: 13.4,
          unit: '°C',
          ts: NOW,
        },
        { dimensions: { location: 'London', metric: 'humidity' }, value: 84, unit: '%', ts: NOW },
        { dimensions: { location: 'London', metric: 'wind' }, value: 13.7, unit: 'm/s', ts: NOW },
      ]),
    );
    expect(data).toMatchObject({
      tempText: '13.4',
      tempUnit: '°C',
      tempDescriptor: 'Mild',
      windDescriptor: 'Strong breeze',
      humidity: '84%',
      windSpeed: '13.7',
      windUnit: 'm/s',
      condition: null,
      weatherCode: null,
      apparentTemp: null,
      feelsLikeC: null,
      precipitation: null,
      uvIndex: null,
      isDay: null,
      forecast: [],
      // No threshold trips → the fallback "Pleasant conditions" sentence.
      advice: 'Pleasant conditions',
    });
  });

  it('returns null for non-weather templates and for empty point sets', () => {
    expect(weatherCardData(make([], 'fx-pair'))).toBeNull();
    expect(weatherCardData(make([]))).toBeNull();
  });

  it('exposes raw current fields and the full 12-hour forecast strip', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 13.4, '°C'),
        currentPoint('humidity', 84, '%'),
        currentPoint('wind', 13.7, 'm/s'),
        currentPoint('feels_like', 11.2, '°C'),
        currentPoint('weather_code', 61),
        currentPoint('precipitation', 0.4, 'mm'),
        currentPoint('uv_index', 2.4),
        currentPoint('is_day', 1),
        ...twelveHourForecast((h) => ({
          temp: 14 + h * 0.5,
          rainProb: h >= 7 ? 75 : 10,
          code: h >= 7 ? 61 : 1,
        })),
      ]),
    );
    expect(data?.condition).toBe('rain');
    expect(data?.weatherCode).toBe(61);
    expect(data?.apparentTemp).toBe(11.2);
    expect(data?.feelsLikeC).toBe(11.2);
    expect(data?.precipitation).toBe(0.4);
    expect(data?.uvIndex).toBe(2.4);
    expect(data?.isDay).toBe(true);
    // All 12 hours present (no striding) so the strip reads as a sparkline.
    expect(data?.forecast.length).toBe(12);
    expect(data?.forecast.map((h) => h.hourOffset)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(data?.forecast[0]).toMatchObject({
      hourOffset: 1,
      temp: 14.5,
      rainProb: 10,
      code: 1,
      condition: 'partly-cloudy',
    });
    expect(data?.forecast[6]).toMatchObject({
      hourOffset: 7,
      rainProb: 75,
      code: 61,
      condition: 'rain',
    });
    // Rain at 75% + current precipitation > 0 → umbrella advice, peak-rain hour embedded.
    expect(data?.advice).toMatch(/^Bring an umbrella — 75% rain at /);
  });

  it('omits forecast hours that are missing a temperature reading', () => {
    const data = weatherCardData(
      make([
        currentPoint('temperature', 10, '°C'),
        // hour 1 only has rain probability — no temperature, so should be dropped.
        ...hourPoints(1, { rainProb: 30, code: 2 }),
        ...hourPoints(2, { temp: 11, rainProb: 20, code: 1 }),
        ...hourPoints(3, { temp: 12, rainProb: 15, code: 1 }),
      ]),
    );
    expect(data?.forecast.map((h) => h.hourOffset)).toEqual([2, 3]);
  });

  it('describes temperature bands in plain English', () => {
    const ranges: ReadonlyArray<[number, string]> = [
      [-5, 'Freezing'],
      [5, 'Cold'],
      [15, 'Mild'],
      [22, 'Warm'],
      [30, 'Hot'],
      [35, 'Very hot'],
    ];
    for (const [t, label] of ranges) {
      const data = weatherCardData(
        make([
          { dimensions: { location: 'L', metric: 'temperature' }, value: t, unit: '°C', ts: NOW },
        ]),
      );
      expect(data?.tempDescriptor).toBe(label);
    }
  });
});
