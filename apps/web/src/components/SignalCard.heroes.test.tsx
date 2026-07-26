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
    // A wet-day fixture so the advice takes the umbrella branch — the most
    // informative variant, and the one that cross-references the strip.
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
    // The shared WeatherIcon stamps the raw condition on the <svg>; WMO 61
    // (drizzle/rain) maps to "rain" in the connector.
    expect(html).toContain('data-condition="rain"');
    expect(html).toContain('data-testid="weather-forecast"');
    for (let h = 1; h <= 12; h += 1) {
      expect(html).toContain(`data-hour-offset="${String(h)}"`);
    }
    // The peak rain hour is labelled by local time (5 hours after noon → "5p")
    // and the advice line repeats that label.
    expect(html).toContain('>5p<');
    expect(html).toContain('data-testid="weather-advice"');
    expect(html).toMatch(/Bring an umbrella — 80% rain at 5p/);
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
});
