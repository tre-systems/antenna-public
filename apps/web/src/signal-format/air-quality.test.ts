import { describe, expect, it } from 'vitest';
import { airQualityCardData, aqiBand } from './air-quality';
import type { ApiSignal } from '../api';

describe('aqiBand', () => {
  it('maps EAQI values to bands with health text', () => {
    expect(aqiBand(10).label).toBe('Very good');
    expect(aqiBand(22).label).toBe('Good');
    expect(aqiBand(50).label).toBe('Moderate');
    expect(aqiBand(70).label).toBe('Poor');
    expect(aqiBand(90).label).toBe('Very poor');
    expect(aqiBand(150).label).toBe('Extremely poor');
  });
});

describe('airQualityCardData', () => {
  const NOW = Date.now();
  const baseSignal: ApiSignal = {
    id: 'aq1',
    template_id: 'airquality',
    visibility: 'private',
    config: { location: 'London' },
    refresh_seconds: 1800,
    status: {
      status: 'live',
      last_ok_at: NOW,
      last_attempt_at: NOW,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [
      { dimensions: { location: 'London', metric: 'aqi' }, value: 22, unit: 'EAQI', ts: NOW },
      { dimensions: { location: 'London', metric: 'pm2_5' }, value: 9.8, unit: 'µg/m³', ts: NOW },
      { dimensions: { location: 'London', metric: 'pm10' }, value: 12.9, unit: 'µg/m³', ts: NOW },
    ],
  };

  it('shapes AQI + PM points into the hero data', () => {
    const data = airQualityCardData(baseSignal);
    expect(data?.aqi).toBe(22);
    expect(data?.band.label).toBe('Good');
    expect(data?.markerPct).toBe(22);
    expect(data?.aqiText).toBe('22');
    expect(data?.pm25).toBe('9.8');
    expect(data?.pm10).toBe('12.9');
  });

  it('clamps the gauge marker to 0–100 for off-scale values', () => {
    const offscale: ApiSignal = {
      ...baseSignal,
      points: [{ dimensions: { location: 'L', metric: 'aqi' }, value: 175, unit: 'EAQI', ts: NOW }],
    };
    expect(airQualityCardData(offscale)?.markerPct).toBe(100);
  });

  it('returns null for non-airquality templates and missing AQI', () => {
    expect(airQualityCardData({ ...baseSignal, template_id: 'weather' })).toBeNull();
    expect(airQualityCardData({ ...baseSignal, points: [] })).toBeNull();
  });
});
