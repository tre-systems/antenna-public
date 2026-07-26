import type { ApiSignal, DataPoint } from '../api';

export function makeSignal(overrides: Partial<ApiSignal> = {}): ApiSignal {
  return {
    id: 'signal-1',
    template_id: 'manual-metric',
    config: {},
    refresh_seconds: 60,
    status: {
      status: 'live',
      last_ok_at: 0,
      last_attempt_at: 0,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [],
    ...overrides,
    visibility: overrides.visibility ?? 'private',
  };
}

export const NOW = Date.now();

const HOUR_MS = 3_600_000;

export const makeWeatherSignal = (
  points: ApiSignal['points'],
  template_id = 'weather',
): ApiSignal =>
  makeSignal({
    id: 'w1',
    template_id,
    config: { location: 'London' },
    refresh_seconds: 1800,
    status: {
      status: 'live',
      last_ok_at: NOW,
      last_attempt_at: NOW,
      last_error: null,
      last_manual_request_at: null,
    },
    points,
  });

export const currentPoint = (metric: string, value: number, unit?: string): DataPoint => ({
  dimensions: { location: 'L', metric },
  value,
  ...(unit !== undefined ? { unit } : {}),
  ts: NOW,
});

type HourShape = { temp?: number; rainProb?: number; code?: number };

// The Open-Meteo connector emits one flat DataPoint per metric per hour.
export const hourPoints = (hourOffset: number, opts: HourShape): DataPoint[] => {
  const ts = NOW + hourOffset * HOUR_MS;
  const dims = (metric: string) => ({ location: 'L', metric, hour: hourOffset });
  const out: DataPoint[] = [];
  if (opts.temp !== undefined) {
    out.push({ dimensions: dims('hourly_temperature'), value: opts.temp, unit: '°C', ts });
  }
  if (opts.rainProb !== undefined) {
    out.push({
      dimensions: dims('hourly_precipitation_probability'),
      value: opts.rainProb,
      unit: '%',
      ts,
    });
  }
  if (opts.code !== undefined) {
    out.push({ dimensions: dims('hourly_weather_code'), value: opts.code, ts });
  }
  return out;
};

export const twelveHourForecast = (shape: (hourOffset: number) => HourShape): DataPoint[] =>
  Array.from({ length: 12 }, (_, i) => hourPoints(i + 1, shape(i + 1))).flat();
