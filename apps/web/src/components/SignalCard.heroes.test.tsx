import { describe, it, expect } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import { makeSignal, NOW } from './signal-card-test-fixtures';

describe('SignalCard weather and air quality heroes', () => {
  it('renders the weather signal as a hero temperature + descriptors', () => {
    const signal = makeSignal({
      template_id: 'weather',
      config: { location: 'London' },
      points: [
        {
          dimensions: { location: 'London', metric: 'temperature' },
          value: 13.4,
          unit: '°C',
          ts: NOW,
        },
        { dimensions: { location: 'London', metric: 'humidity' }, value: 84, unit: '%', ts: NOW },
        { dimensions: { location: 'London', metric: 'wind' }, value: 13.7, unit: 'm/s', ts: NOW },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-testid="weather-hero"');
    expect(html).toContain('13.4');
    expect(html).not.toContain('13.4000');
    expect(html).toContain('°C');
    expect(html).toContain('Mild');
    expect(html).toContain('Strong breeze');
    expect(html).toContain('humidity');
    expect(html).toContain('84%');
  });

  it('renders the weather forecast strip, WMO icon, and advice line', () => {
    // Wet weather exercises advice that cross-references the forecast strip.
    const FIXED_NOON = new Date();
    FIXED_NOON.setHours(12, 0, 0, 0);
    const noonMs = FIXED_NOON.getTime();
    const hourPoint = (
      hourOffset: number,
      metric: 'hourly_temperature' | 'hourly_precipitation_probability' | 'hourly_weather_code',
      value: number,
    ) => ({
      dimensions: { location: 'London', metric, hour: hourOffset },
      value,
      ts: noonMs + hourOffset * 3_600_000,
    });
    const hours = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((h) => [
      hourPoint(h, 'hourly_temperature', 12),
      hourPoint(h, 'hourly_precipitation_probability', h === 5 ? 80 : 20),
      hourPoint(h, 'hourly_weather_code', h === 5 ? 61 : 1),
    ]);
    const signal = makeSignal({
      template_id: 'weather',
      config: { location: 'London' },
      points: [
        {
          dimensions: { location: 'London', metric: 'temperature' },
          value: 12,
          unit: '°C',
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'feels_like' },
          value: 12,
          unit: '°C',
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'precipitation' },
          value: 0.3,
          unit: 'mm',
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'weather_code' },
          value: 61,
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'is_day' },
          value: 1,
          ts: noonMs,
        },
        ...hours,
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    // WMO 61 maps to the rain icon.
    expect(html).toContain('data-condition="rain"');
    expect(html).toContain('data-testid="weather-forecast"');
    for (let h = 1; h <= 12; h += 1) {
      expect(html).toContain(`data-hour-offset="${String(h)}"`);
    }
    // Advice repeats the peak-rain local-time label.
    expect(html).toContain('>5p<');
    expect(html).toContain('data-testid="weather-advice"');
    expect(html).toMatch(/Bring an umbrella — 80% rain at 5p/);
  });

  it('renders the daily forecast strip and collapsed weather summary', () => {
    const dayPoint = (
      day: number,
      metric: 'daily_temp_max' | 'daily_temp_min' | 'daily_rain_prob' | 'daily_weather_code',
      value: number,
    ) => ({
      dimensions: { location: 'London', metric, day },
      value,
      ts: NOW + day * 86_400_000,
    });
    const days = Array.from({ length: 6 }, (_, d) => d).flatMap((d) => [
      dayPoint(d, 'daily_temp_max', 18 + d),
      dayPoint(d, 'daily_temp_min', 8 + d),
      dayPoint(d, 'daily_rain_prob', d === 2 ? 70 : 0),
      dayPoint(d, 'daily_weather_code', d === 2 ? 61 : 0),
    ]);
    const signal = makeSignal({
      template_id: 'weather',
      config: { location: 'London' },
      points: [
        {
          dimensions: { location: 'London', metric: 'temperature' },
          value: 15.2,
          unit: '°C',
          ts: NOW,
        },
        { dimensions: { location: 'London', metric: 'weather_code' }, value: 0, ts: NOW },
        { dimensions: { location: 'London', metric: 'is_day' }, value: 1, ts: NOW },
        ...days,
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    // Both the expanded hero strip and the collapsed summary strip render.
    expect(html).toContain('data-testid="weather-summary"');
    expect(html).toContain('data-testid="weather-daily"');
    for (let d = 0; d <= 5; d += 1) {
      expect(html).toContain(`data-day-offset="${String(d)}"`);
    }
    expect(html).toContain('Today');
    // Day 2 is the wet one: rain icon and its 70% chance.
    expect(html).toContain('data-condition="rain"');
    expect(html).toContain('70%');
  });

  it('renders the air quality signal with a hero AQI + gauge + health text', () => {
    const signal = makeSignal({
      template_id: 'airquality',
      config: { location: 'London' },
      points: [
        { dimensions: { location: 'London', metric: 'aqi' }, value: 22, unit: 'EAQI', ts: NOW },
        { dimensions: { location: 'London', metric: 'pm2_5' }, value: 9.8, unit: 'µg/m³', ts: NOW },
        { dimensions: { location: 'London', metric: 'pm10' }, value: 12.9, unit: 'µg/m³', ts: NOW },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-testid="airquality-hero"');
    expect(html).toContain('22');
    expect(html).toContain('EAQI');
    expect(html).toContain('Good');
    expect(html).toContain('acceptable');
    expect(html).toContain('linear-gradient');
    expect(html).toMatch(/left:\s*22%/);
    expect(html).toContain('PM2.5');
    expect(html).toContain('PM10');
  });

  it('renders the 48-hour AQI trend chart and collapsed summary', () => {
    const hourly = (hour: number, aqi: number) => ({
      dimensions: { location: 'London', metric: 'hourly_aqi', hour },
      value: aqi,
      unit: 'EAQI',
      ts: NOW + hour * 3_600_000,
    });
    const trend = Array.from({ length: 48 }, (_, i) => hourly(i - 24, 25 + (i % 10)));
    const signal = makeSignal({
      template_id: 'airquality',
      config: { location: 'London' },
      points: [
        { dimensions: { location: 'London', metric: 'aqi' }, value: 34, unit: 'EAQI', ts: NOW },
        ...trend,
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-testid="airquality-summary"');
    expect(html).toContain('data-testid="airquality-trend"');
    expect(html).toContain('-24h');
    expect(html).toContain('+23h');
    expect(html).toContain('>now<');
  });
});
