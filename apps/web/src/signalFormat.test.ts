import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  airQualityCardData,
  appUsageCardData,
  aqiBand,
  cloudflareFleetCardData,
  costCardData,
  signalSourceLabel,
  signalSourceUrl,
  signalTitle,
  compactNumber,
  compactRowsCardData,
  displayPoints,
  forecastHourLabel,
  formatValue,
  formatCurrency,
  githubTrendingCardData,
  karpathyCardData,
  pointLabel,
  pointSourceUrl,
  pointValueText,
  weatherCardData,
  weatherCondition,
} from './signalFormat';
import type { ApiSignal, DataPoint } from './api';

describe('formatValue', () => {
  it('renders integers without decimals — "0", not "0.00"', () => {
    expect(formatValue(0)).toBe('0');
    expect(formatValue(3)).toBe('3');
    expect(formatValue(1234)).toBe('1,234');
  });

  it('renders fractional values with exactly 2 decimals', () => {
    // Smaller fractions used to render with 4 decimals to preserve FX
    // precision; the rest of the collection's chips/percents use 2, so
    // the hero number now matches that convention.
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

describe('cost formatting', () => {
  it('formats currencies for billing cards', () => {
    expect(formatCurrency(12.3, 'GBP')).toBe('£12.30');
    expect(formatCurrency(4, 'USD')).toBe('US$4.00');
  });

  it('builds provider-neutral cost card data from cost-family dimensions', () => {
    const data = costCardData(
      makeSignal({
        template_id: 'manual-cost',
        points: [
          {
            dimensions: {
              family: 'cost',
              metric: 'cost',
              period: 'today',
              posture: 'manual',
              provider: 'Modal',
              service: 'Inference',
              project: 'Example App',
            },
            value: 1.25,
            unit: 'USD',
            ts: 1,
          },
          {
            dimensions: {
              family: 'cost',
              metric: 'cost',
              period: 'month_to_date',
              posture: 'manual',
              provider: 'Modal',
              service: 'Inference',
              project: 'Example App',
            },
            value: 18.5,
            unit: 'USD',
            ts: 2,
          },
        ],
      }),
    );

    expect(data).toMatchObject({
      posture: 'manual',
      headline: {
        formattedAmount: 'US$18.50',
        periodLabel: 'month to date',
      },
    });
  });

  it('ignores ordinary numeric signals', () => {
    expect(
      costCardData(
        makeSignal({
          template_id: 'manual-metric',
          points: [{ dimensions: { label: 'Users' }, value: 10, unit: 'people', ts: 1 }],
        }),
      ),
    ).toBeNull();
  });
});

describe('pointLabel', () => {
  it('prefers server-resolved point display labels', () => {
    expect(
      pointLabel({
        dimensions: { metric: 'recent_vulnerability', rank: '1' },
        value: null,
        display: { label: 'Server label', source_url: null },
      }),
    ).toBe('Server label');
  });

  it('prefers a known metric and maps it to a short human label', () => {
    expect(
      pointLabel({ dimensions: { location: 'London', metric: 'temperature' }, value: 13, ts: 0 }),
    ).toBe('Temp');
    expect(pointLabel({ dimensions: { metric: 'next_event' }, value: '...', ts: 0 })).toBe('Next');
    expect(pointLabel({ dimensions: { metric: 'pm2_5' }, value: 6, ts: 0 })).toBe('PM2.5');
  });

  it('humanises an unknown metric (underscore → space, title case)', () => {
    expect(pointLabel({ dimensions: { metric: 'foo_bar' }, value: 1, ts: 0 })).toBe('Foo Bar');
  });

  it('strips the exchange suffix from a ticker dimension', () => {
    expect(
      pointLabel({ dimensions: { ticker: 'VTI.US', exchange: 'STOOQ' }, value: 360, ts: 0 }),
    ).toBe('VTI');
    expect(
      pointLabel({ dimensions: { ticker: 'AZN.UK', exchange: 'STOOQ' }, value: 1900, ts: 0 }),
    ).toBe('AZN');
  });

  it('uses pair or label as a fallback', () => {
    expect(pointLabel({ dimensions: { pair: 'EUR/USD' }, value: 1.1, ts: 0 })).toBe('EUR/USD');
    expect(pointLabel({ dimensions: { label: 'Custom' }, value: 1, ts: 0 })).toBe('Custom');
  });

  it('uses rank labels for ranked-list signals', () => {
    expect(
      pointLabel({
        dimensions: { source: 'github-trending', rank: '1' },
        value: 'owner/repo',
        ts: 0,
      }),
    ).toBe('#1');
  });

  it('uses compact labels for commodity metrics', () => {
    expect(pointLabel({ dimensions: { metric: 'au_price' }, value: 4485.4, ts: 0 })).toBe('Au');
    expect(pointLabel({ dimensions: { metric: 'ag_1h_vol' }, value: 36.9, ts: 0 })).toBe(
      'Ag 1h Vol',
    );
    expect(pointLabel({ dimensions: { metric: 'xau_3m_dicor' }, value: 4.16, ts: 0 })).toBe(
      'Au 3M DICOR',
    );
  });

  it('uses compact labels for Karpathy jobs metrics', () => {
    expect(pointLabel({ dimensions: { metric: 'occupations' }, value: 342, ts: 0 })).toBe('Roles');
    expect(
      pointLabel({ dimensions: { metric: 'weighted_ai_exposure' }, value: '4.9 / 10', ts: 0 }),
    ).toBe('AI exposure');
  });
});

describe('pointSourceUrl', () => {
  it('prefers server-resolved point display source URLs', () => {
    expect(
      pointSourceUrl(
        {
          dimensions: { ticker: 'VTI.US' },
          value: 360,
          source_url: 'https://legacy.example/source',
          display: { label: 'VTI', source_url: 'https://server.example/source' },
        },
        makeSignal({ template_id: 'equity-watchlist' }),
      ),
    ).toBe('https://server.example/source');
  });

  it('drops executable point links', () => {
    expect(
      pointSourceUrl(
        {
          dimensions: {},
          value: 1,
          display: { label: 'Unsafe', source_url: 'javascript:alert(1)' },
        },
        makeSignal({ template_id: 'manual-metric' }),
      ),
    ).toBeNull();
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

describe('weatherCardData', () => {
  const NOW = Date.now();
  const make = (points: ApiSignal['points'], template_id = 'weather'): ApiSignal => ({
    id: 'w1',
    template_id,
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
    points,
  });

  // The Open-Meteo connector emits a flat list of DataPoints — one per
  // metric for the current observation and three per future hour (temp,
  // rain probability, WMO code). These helpers shape that into a signal we
  // can render without each test having to spell out the same boilerplate.
  const HOUR_MS = 3_600_000;
  const currentPoint = (metric: string, value: number, unit?: string): DataPoint => ({
    dimensions: { location: 'L', metric },
    value,
    ...(unit !== undefined ? { unit } : {}),
    ts: NOW,
  });
  const hourPoints = (
    hourOffset: number,
    opts: { temp?: number; rainProb?: number; code?: number },
  ): DataPoint[] => {
    const ts = NOW + hourOffset * HOUR_MS;
    const out: DataPoint[] = [];
    if (opts.temp !== undefined) {
      out.push({
        dimensions: { location: 'L', metric: 'hourly_temperature', hour: hourOffset },
        value: opts.temp,
        unit: '°C',
        ts,
      });
    }
    if (opts.rainProb !== undefined) {
      out.push({
        dimensions: {
          location: 'L',
          metric: 'hourly_precipitation_probability',
          hour: hourOffset,
        },
        value: opts.rainProb,
        unit: '%',
        ts,
      });
    }
    if (opts.code !== undefined) {
      out.push({
        dimensions: { location: 'L', metric: 'hourly_weather_code', hour: hourOffset },
        value: opts.code,
        ts,
      });
    }
    return out;
  };
  const twelveHourForecast = (
    shape: (hourOffset: number) => { temp?: number; rainProb?: number; code?: number },
  ): DataPoint[] => Array.from({ length: 12 }, (_, i) => hourPoints(i + 1, shape(i + 1))).flat();

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
    // Rain at 75% + current precipitation > 0 → umbrella advice with the
    // peak-rain hour label embedded.
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

  describe('advice variants', () => {
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
      // Without precipitation > 0 the rain rule does not apply — falls
      // through to the next priority.
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

  describe('forecastHourLabel', () => {
    // Build a forecast hour at a known local hour so the label is
    // deterministic regardless of the test runner's timezone.
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

describe('githubTrendingCardData', () => {
  const NOW = Date.now();
  const make = (points: ApiSignal['points'], template_id = 'github-trending'): ApiSignal => ({
    id: 'gt1',
    template_id,
    visibility: 'private',
    config: {},
    refresh_seconds: 21_600,
    status: {
      status: 'live',
      last_ok_at: NOW,
      last_attempt_at: NOW,
      last_error: null,
      last_manual_request_at: null,
    },
    points,
  });

  it('parses repo · language · stars and returns rows sorted by rank', () => {
    const rows = githubTrendingCardData(
      make([
        {
          dimensions: { source: 'github-trending', rank: '2' },
          value: 'two/repo · Python · +20 stars today',
          display: { label: 'two/repo', source_url: 'https://github.com/two/repo' },
          ts: NOW,
        },
        {
          dimensions: { source: 'github-trending', rank: '1' },
          value: 'one/repo · TypeScript · +40 stars today',
          display: { label: 'one/repo', source_url: 'https://github.com/one/repo' },
          ts: NOW,
        },
      ]),
    );
    expect(rows).toEqual([
      {
        rank: 1,
        repo: 'one/repo',
        url: 'https://github.com/one/repo',
        language: 'TypeScript',
        starsToday: '40',
      },
      {
        rank: 2,
        repo: 'two/repo',
        url: 'https://github.com/two/repo',
        language: 'Python',
        starsToday: '20',
      },
    ]);
  });

  it('handles missing language and missing stars gracefully', () => {
    const rows = githubTrendingCardData(
      make([
        {
          dimensions: { source: 'github-trending', rank: 1 },
          value: 'bare/repo',
          ts: NOW,
        },
        {
          dimensions: { source: 'github-trending', rank: 2 },
          value: 'lang/only · Rust',
          ts: NOW,
        },
        {
          dimensions: { source: 'github-trending', rank: 3 },
          value: 'stars/only · +1,234 stars today',
          ts: NOW,
        },
      ]),
    );
    expect(rows).toEqual([
      { rank: 1, repo: 'bare/repo', url: null },
      { rank: 2, repo: 'lang/only', url: null, language: 'Rust' },
      { rank: 3, repo: 'stars/only', url: null, starsToday: '1,234' },
    ]);
  });

  it('returns null for non-github-trending templates and empty point sets', () => {
    expect(githubTrendingCardData(make([], 'fx-pair'))).toBeNull();
    expect(githubTrendingCardData(make([]))).toBeNull();
  });
});

describe('karpathyCardData', () => {
  const NOW = Date.now();
  const baseSignal: ApiSignal = {
    id: 'k1',
    template_id: 'karpathy-jobs-snapshot',
    visibility: 'private',
    config: {},
    refresh_seconds: 604_800,
    status: {
      status: 'live',
      last_ok_at: NOW,
      last_attempt_at: NOW,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [
      { dimensions: { metric: 'occupations' }, value: 341, ts: NOW },
      { dimensions: { metric: 'jobs_analyzed' }, value: 143_066_500, unit: 'jobs', ts: NOW },
      {
        dimensions: { metric: 'weighted_ai_exposure' },
        value: null,
        value_text: '4.9 / 10',
        ts: NOW,
      },
      { dimensions: { metric: 'high_exposure_jobs' }, value: 49_009_400, unit: 'jobs', ts: NOW },
      { dimensions: { metric: 'high_exposure_share' }, value: null, value_text: '34%', ts: NOW },
    ],
  };

  it('shapes the five summary points into a hero + context view', () => {
    expect(karpathyCardData(baseSignal)).toEqual({
      share: '34%',
      weighted: '4.9 / 10',
      occupations: '341',
      totalJobs: '143M',
      highJobs: '49M',
      topRoles: [],
    });
  });

  it('returns null for signals that are not karpathy-jobs-snapshot', () => {
    expect(karpathyCardData({ ...baseSignal, template_id: 'fx-pair' })).toBeNull();
  });

  it('returns null when no points have arrived yet', () => {
    expect(karpathyCardData({ ...baseSignal, points: [] })).toBeNull();
  });

  it('fills missing metrics with an em-dash so the layout never breaks', () => {
    const partial: ApiSignal = {
      ...baseSignal,
      points: [
        { dimensions: { metric: 'high_exposure_share' }, value: null, value_text: '34%', ts: NOW },
      ],
    };
    expect(karpathyCardData(partial)).toEqual({
      share: '34%',
      weighted: '—',
      occupations: '—',
      totalJobs: '—',
      highJobs: '—',
      topRoles: [],
    });
  });

  it('surfaces up to 5 top exposed roles, sorted by rank', () => {
    const withRoles: ApiSignal = {
      ...baseSignal,
      points: [
        ...baseSignal.points,
        { dimensions: { metric: 'top_role', rank: 3 }, value: 'Accountants', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 1 }, value: 'Programmers', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 2 }, value: 'Mathematicians', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 4 }, value: 'Auditors', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 5 }, value: 'Web developers', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 6 }, value: 'Loan officers', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 7 }, value: 'Tax preparers', ts: NOW },
      ],
    };
    expect(karpathyCardData(withRoles)?.topRoles).toEqual([
      'Programmers',
      'Mathematicians',
      'Accountants',
      'Auditors',
      'Web developers',
    ]);
  });

  it('handles string-typed rank dimensions from the wire shape', () => {
    const stringRanks: ApiSignal = {
      ...baseSignal,
      points: [
        ...baseSignal.points,
        { dimensions: { metric: 'top_role', rank: '2' }, value: 'B', ts: NOW },
        { dimensions: { metric: 'top_role', rank: '1' }, value: 'A', ts: NOW },
      ],
    };
    expect(karpathyCardData(stringRanks)?.topRoles).toEqual(['A', 'B']);
  });
});

describe('appUsageCardData', () => {
  // Fixed "today" so the zero-filled day window is deterministic.
  const TODAY = Date.UTC(2026, 6, 11); // 2026-07-11 UTC

  const usagePoint = (day: string, event: string, value: number): DataPoint => ({
    dimensions: { source: 'app-usage', project: 'sample-app', event, day },
    value,
    unit: 'events',
    ts: Date.parse(`${day}T00:00:00Z`),
  });

  const baseSignal: ApiSignal = {
    id: 'u1',
    template_id: 'app-usage',
    visibility: 'private',
    config: { project: 'sample-app', account_id: 'a'.repeat(32) },
    refresh_seconds: 3600,
    status: {
      status: 'live',
      last_ok_at: TODAY,
      last_attempt_at: TODAY,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [
      usagePoint('2026-07-11', 'character_generated', 5),
      usagePoint('2026-07-11', 'character_saved', 2),
      usagePoint('2026-07-10', 'character_generated', 3),
      usagePoint('2026-07-05', 'portrait_generated', 1),
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for non-app-usage signals and before any points arrive', () => {
    expect(appUsageCardData({ ...baseSignal, template_id: 'fx-pair' })).toBeNull();
    expect(appUsageCardData({ ...baseSignal, points: [] })).toBeNull();
  });

  it('builds a zero-filled daily series with the window total and top events', () => {
    const data = appUsageCardData(baseSignal);
    expect(data).not.toBeNull();
    if (!data) return;

    expect(data.windowDays).toBe(14);
    expect(data.days).toHaveLength(14);
    expect(data.days[0]).toBe('2026-06-28');
    expect(data.days[13]).toBe('2026-07-11');
    expect(data.series).toHaveLength(14);
    // 2026-07-05 → 1, 2026-07-10 → 3, 2026-07-11 → 7, everything else 0.
    expect(data.series[7]).toBe(1); // 2026-07-05
    expect(data.series[12]).toBe(3); // 2026-07-10
    expect(data.series[13]).toBe(7); // 2026-07-11
    expect(data.series.reduce((a, b) => a + b, 0)).toBe(11);
    expect(data.totalEvents).toBe(11);
    expect(data.todayCount).toBe(7);
    expect(data.peakCount).toBe(7);
    expect(data.topEvents).toEqual([
      { event: 'character_generated', count: 8 },
      { event: 'character_saved', count: 2 },
      { event: 'portrait_generated', count: 1 },
    ]);
  });

  it('ignores the synthetic zero-activity event and non-positive counts', () => {
    const data = appUsageCardData({
      ...baseSignal,
      points: [
        {
          dimensions: { source: 'app-usage', project: 'x', event: 'total', day: '2026-07-11' },
          value: 0,
          ts: TODAY,
        },
        usagePoint('2026-07-11', 'noise', 0),
      ],
    });
    expect(data?.totalEvents).toBe(0);
    expect(data?.topEvents).toEqual([]);
    expect(data?.series.every((n) => n === 0)).toBe(true);
  });

  it('drops points that fall outside the configured window so totals reconcile', () => {
    const data = appUsageCardData({
      ...baseSignal,
      config: { ...baseSignal.config, days: 7 },
      points: [
        usagePoint('2026-07-11', 'character_saved', 4),
        usagePoint('2026-06-01', 'character_saved', 99), // outside the 7-day window
      ],
    });
    expect(data?.windowDays).toBe(7);
    expect(data?.days).toHaveLength(7);
    expect(data?.totalEvents).toBe(4);
    expect(data?.topEvents).toEqual([{ event: 'character_saved', count: 4 }]);
  });
});

describe('cloudflareFleetCardData', () => {
  const TODAY = Date.UTC(2026, 6, 11); // 2026-07-11 UTC

  const dayPoint = (day: string, requests: number): DataPoint => ({
    dimensions: { source: 'cloudflare-analytics', kind: 'day', day, metric: 'requests' },
    value: requests,
    unit: 'requests',
    ts: Date.parse(`${day}T00:00:00Z`),
  });
  // Dimensions round-trip through JSON as strings, so errors arrives as a string.
  const workerPoint = (script: string, requests: number, errors: number): DataPoint => ({
    dimensions: {
      source: 'cloudflare-analytics',
      kind: 'worker',
      window: 'current',
      script,
      errors: String(errors),
      error_rate_ppm: errors > 0 ? String(Math.round((errors / requests) * 1_000_000)) : '0',
      metric: 'requests',
    },
    value: requests,
    unit: 'requests',
    ts: TODAY,
  });

  const baseSignal: ApiSignal = {
    id: 'cf1',
    template_id: 'cloudflare-analytics',
    visibility: 'private',
    config: { account_id: 'a'.repeat(32), days: 7 },
    refresh_seconds: 3600,
    status: {
      status: 'live',
      last_ok_at: TODAY,
      last_attempt_at: TODAY,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [
      dayPoint('2026-07-09', 100),
      dayPoint('2026-07-10', 250),
      workerPoint('antenna', 300, 2),
      workerPoint('example-worker', 50, 0),
      {
        dimensions: {
          source: 'cloudflare-analytics',
          kind: 'worker-comparison',
          window: 'previous',
          script: 'antenna',
          errors: '1',
          error_rate_ppm: '5000',
          metric: 'requests',
        },
        value: 200,
        unit: 'requests',
        ts: TODAY,
      },
      {
        dimensions: {
          source: 'cloudflare-analytics',
          kind: 'fleet-window',
          window: 'current',
          window_start: '2026-07-10T08:00:00.000Z',
          window_end: '2026-07-11T08:00:00.000Z',
          errors: '2',
          error_rate_ppm: '5714',
          metric: 'requests',
        },
        value: 350,
        unit: 'requests',
        ts: TODAY,
      },
      {
        dimensions: {
          source: 'cloudflare-analytics',
          kind: 'fleet-window',
          window: 'previous',
          window_start: '2026-07-09T08:00:00.000Z',
          window_end: '2026-07-10T08:00:00.000Z',
          errors: '1',
          error_rate_ppm: '4000',
          metric: 'requests',
        },
        value: 250,
        unit: 'requests',
        ts: TODAY,
      },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for non-fleet signals and before any points arrive', () => {
    expect(cloudflareFleetCardData({ ...baseSignal, template_id: 'app-usage' })).toBeNull();
    expect(cloudflareFleetCardData({ ...baseSignal, points: [] })).toBeNull();
  });

  it('builds the daily request trend plus the per-worker breakdown', () => {
    const data = cloudflareFleetCardData(baseSignal);
    expect(data).not.toBeNull();
    if (!data) return;

    expect(data.windowDays).toBe(7);
    expect(data.days).toHaveLength(7);
    expect(data.series[5]).toBe(100); // 2026-07-09
    expect(data.series[6]).toBe(250); // 2026-07-10
    expect(data.totalRequests).toBe(350);
    expect(data.peakCount).toBe(250);
    expect(data.workerCount).toBe(2);
    expect(data.totalErrors).toBe(2);
    expect(data.workers).toEqual([
      {
        script: 'antenna',
        requests: 300,
        errors: 2,
      },
      {
        script: 'example-worker',
        requests: 50,
        errors: 0,
      },
    ]);
    expect(data.currentWindowRequests).toBe(350);
    expect(data.previousWindowRequests).toBe(250);
    expect(data.currentWindowErrors).toBe(2);
    expect(data.currentErrorRatePpm).toBe(5714);
    expect(data.requestChangePercent).toBe(40);
  });

  it('keeps a quiet account live with a zero total', () => {
    const data = cloudflareFleetCardData({
      ...baseSignal,
      points: [dayPoint('2026-07-10', 0)],
    });
    expect(data?.totalRequests).toBe(0);
    expect(data?.workers).toEqual([]);
    expect(data?.currentWindowRequests).toBe(0);
    expect(data?.previousWindowRequests).toBeNull();
  });
});

describe('displayPoints', () => {
  it('sorts GitHub Trending points by rank while preserving other signal order', () => {
    const ranked = makeSignal({
      template_id: 'github-trending',
      points: [
        { dimensions: { source: 'github-trending', rank: '2' }, value: 'two', ts: 0 },
        { dimensions: { source: 'github-trending', rank: '1' }, value: 'one', ts: 0 },
      ],
    });
    expect(displayPoints(ranked).map((point) => pointValueText(point))).toEqual(['one', 'two']);

    const unranked = makeSignal({
      points: [
        { dimensions: { label: 'B' }, value: 2, ts: 0 },
        { dimensions: { label: 'A' }, value: 1, ts: 0 },
      ],
    });
    expect(displayPoints(unranked).map((point) => pointLabel(point))).toEqual(['B', 'A']);
  });

  it('formats market-history symbols and explicit labels', () => {
    expect(
      signalTitle(makeSignal({ template_id: 'market-history', config: { symbol: 'MSFT' } })),
    ).toBe('MSFT 1Y');
    expect(
      signalTitle(makeSignal({ template_id: 'market-history', config: { symbol: 'AZN.L' } })),
    ).toBe('AZN 1Y');
    // cfg.label overrides the derived symbol title.
    expect(
      signalTitle(
        makeSignal({
          template_id: 'market-history',
          config: { symbol: 'MSFT', label: 'Custom label' },
        }),
      ),
    ).toBe('Custom label 1Y');
  });

  it('picks the latest fx-pair point using observed_at when the API sends it', () => {
    // Regression: when fx-pair backfill started landing ~255 daily points the
    // SPA-side `mostRecent` selector was filtering on `point.ts`, but the API
    // exposes wire timestamps. Result: empty array → "Waiting for the next
    // tick…" hero on production while the sparkline rendered fine. Prefer the
    // explicit observed_at field over the legacy compatibility fetched_at.
    const fx = makeSignal({
      template_id: 'fx-pair',
      config: { base: 'AUD', quote: 'USD' },
      points: [
        {
          dimensions: { pair: 'AUD/USD' },
          value: 0.713,
          unit: 'USD',
          observed_at: 4,
          fetched_at: 1,
        },
        { dimensions: { pair: 'AUD/USD' }, value: 0.7117, unit: 'USD', fetched_at: 3 },
        { dimensions: { pair: 'AUD/USD' }, value: 0.7099, unit: 'USD', fetched_at: 2 },
        { dimensions: { pair: 'AUD/USD' }, value: 0.7081, unit: 'USD', fetched_at: 1 },
      ],
    });
    const out = displayPoints(fx);
    expect(out).toHaveLength(1);
    expect(out[0]?.value).toBe(0.713);
  });
});

describe('compactRowsCardData', () => {
  it('shapes cloudflare-incidents into ranked rows with status chips', () => {
    const signal = makeSignal({
      template_id: 'cloudflare-incidents',
      points: [
        {
          dimensions: { metric: 'incident', rank: '2', status: 'resolved', components: 'Workers' },
          value: null,
          value_text: 'Workers slow',
          source_url: 'https://stspg.io/x',
        },
        {
          dimensions: {
            metric: 'incident',
            rank: '1',
            status: 'investigating',
            components: 'Access',
          },
          value: null,
          value_text: 'Cloudflare Access delayed audit logs',
          source_url: 'https://stspg.io/y',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows.map((r) => r.title)).toEqual([
      'Cloudflare Access delayed audit logs',
      'Workers slow',
    ]);
    expect(out?.rows[0]?.chip).toBe('investigating');
    expect(out?.rows[0]?.chipTone).toBe('urgent');
    expect(out?.rows[1]?.chipTone).toBe('ok');
    expect(out?.summary).toBe('1 active');
  });

  it('strips the "CRITICAL · " prefix from GHSA rows because the chip already says CRITICAL', () => {
    const signal = makeSignal({
      template_id: 'github-security-advisories',
      points: [
        {
          dimensions: {
            metric: 'advisory',
            rank: '1',
            severity: 'critical',
            packages: '@cap-js/sqlite',
          },
          value: null,
          value_text: 'CRITICAL · Supply chain compromise via malicious versions',
          source_url: 'https://github.com/advisories/x',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows[0]?.title).toBe('Supply chain compromise via malicious versions');
    expect(out?.rows[0]?.chip).toBe('CRITICAL');
    expect(out?.rows[0]?.chipTone).toBe('urgent');
  });

  it('formats UK BoE publications as relative-time chips ("in 4w")', () => {
    const signal = makeSignal({
      template_id: 'uk-economic-calendar',
      points: [
        {
          dimensions: { metric: 'publication', rank: '1', date: '2026-06-18', days_until: '28' },
          value: null,
          value_text: 'Monetary Policy Summary and minutes',
          source_url: 'https://www.bankofengland.co.uk/x',
        },
      ],
    });
    const row = compactRowsCardData(signal)?.rows[0];
    expect(row?.title).toBe('Monetary Policy Summary and minutes');
    expect(row?.subtitle).toBe('2026-06-18');
    expect(row?.chip).toBe('in 4w');
  });

  it('tones UK BoE countdown chips by urgency (tomorrow=urgent, 5d=warn, 21d=ok)', () => {
    const signal = makeSignal({
      template_id: 'uk-economic-calendar',
      points: [
        {
          dimensions: { metric: 'publication', rank: '1', date: '2026-05-23', days_until: '1' },
          value: null,
          value_text: 'Monetary Policy Summary',
          source_url: 'https://www.bankofengland.co.uk/a',
        },
        {
          dimensions: { metric: 'publication', rank: '2', date: '2026-05-27', days_until: '5' },
          value: null,
          value_text: 'Financial Stability Report',
          source_url: 'https://www.bankofengland.co.uk/b',
        },
        {
          dimensions: { metric: 'publication', rank: '3', date: '2026-06-12', days_until: '21' },
          value: null,
          value_text: 'Bank Rate decision',
          source_url: 'https://www.bankofengland.co.uk/c',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.summary).toBe('Next 3 events');
    expect(out?.rows.map((r) => r.chip)).toEqual(['tomorrow', 'in 5d', 'in 3w']);
    expect(out?.rows.map((r) => r.chipTone)).toEqual(['urgent', 'warn', 'ok']);
    expect(out?.rows.map((r) => r.title)).toEqual([
      'Monetary Policy Summary',
      'Financial Stability Report',
      'Bank Rate decision',
    ]);
  });

  it('returns null for templates without ranked incident-shaped data', () => {
    expect(compactRowsCardData(makeSignal({ template_id: 'fx-pair' }))).toBeNull();
    expect(compactRowsCardData(makeSignal({ template_id: 'weather' }))).toBeNull();
  });

  it('shapes aa-highlights intelligence into rows with index score chips', () => {
    const signal = makeSignal({
      template_id: 'aa-highlights',
      config: { category: 'intelligence' },
      points: [
        {
          dimensions: { metric: 'aa_intelligence', rank: 1, model: 'GPT-5.5 (xhigh)' },
          value: 60.24,
          unit: '',
          source_url: 'https://artificialanalysis.ai/models/gpt-5-5',
        },
        {
          dimensions: { metric: 'aa_intelligence', rank: 2, model: 'Claude Opus 4.7 (max)' },
          value: 57.28,
          unit: '',
        },
        {
          dimensions: { metric: 'aa_intelligence', rank: 3, model: 'Kimi K2.6' },
          value: 43.5,
          unit: '',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);
    expect(out?.rows[0]?.title).toBe('GPT-5.5 (xhigh)');
    expect(out?.rows[0]?.chip).toBe('60.2');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[0]?.href).toBe('https://artificialanalysis.ai/models/gpt-5-5');
    expect(out?.rows[1]?.chipTone).toBe('ok');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 by intelligence');
  });

  it('shows frontier intelligence, speed, and price in one comparable row set', () => {
    const signal = makeSignal({
      template_id: 'aa-frontier',
      points: [
        {
          dimensions: {
            metric: 'aa_frontier',
            rank: 1,
            model: 'Model A',
            speed: 125,
            price: 2.5,
          },
          value: 61,
          unit: 'index',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.summary).toBe('Top 1 · score, speed & price');
    expect(out?.rows[0]).toMatchObject({
      title: 'Model A',
      subtitle: '125 tok/s · $2.5/M',
      chip: '61.0',
    });
  });

  it('summarises product activity across the configured project portfolio', () => {
    const signal = makeSignal({
      template_id: 'project-portfolio',
      points: [
        {
          dimensions: {
            metric: 'project_activity',
            rank: 1,
            project: 'example-site',
            previous: 5,
            change: 100,
            top_event: 'page_view',
          },
          value: 10,
          unit: 'events',
        },
        {
          dimensions: {
            metric: 'project_activity',
            rank: 2,
            project: 'demo-game',
            previous: 0,
            change: 0,
            top_event: '',
          },
          value: 0,
          unit: 'events',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.summary).toBe('10 product events · 1/2 active');
    expect(out?.rows[0]).toMatchObject({
      title: 'Example Site',
      subtitle: '+100% vs prior · page view',
      chip: '10 events',
    });
    expect(out?.rows[1]).toMatchObject({ title: 'Demo Game', subtitle: 'quiet' });
  });

  it('shapes aa-highlights speed into rows with tok/s chips', () => {
    const signal = makeSignal({
      template_id: 'aa-highlights',
      config: { category: 'speed' },
      points: [
        {
          dimensions: { metric: 'aa_speed', rank: 1, model: 'gpt-oss-120b (high)' },
          value: 248.3,
          unit: 'tok/s',
        },
        {
          dimensions: { metric: 'aa_speed', rank: 2, model: 'Gemini 3.5 Flash' },
          value: 72,
          unit: 'tok/s',
        },
        {
          dimensions: { metric: 'aa_speed', rank: 3, model: 'Slow Model' },
          value: 30,
          unit: 'tok/s',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows[0]?.chip).toBe('248 tok/s');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[1]?.chipTone).toBe('info');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 fastest');
  });

  it('shapes aa-highlights price into rows with $/M chips', () => {
    const signal = makeSignal({
      template_id: 'aa-highlights',
      config: { category: 'price' },
      points: [
        {
          dimensions: { metric: 'aa_price', rank: 1, model: 'gpt-oss-120b (high)' },
          value: 0.195,
          unit: '$/M',
        },
        {
          dimensions: { metric: 'aa_price', rank: 2, model: 'Claude Opus 4.7 (max)' },
          value: 4.1,
          unit: '$/M',
        },
        {
          dimensions: { metric: 'aa_price', rank: 3, model: 'GPT-5.5 (xhigh)' },
          value: 8.0,
          unit: '$/M',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows[0]?.chip).toBe('$0.20/M');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[1]?.chipTone).toBe('info');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 cheapest');
  });

  it('shapes tbench-leaderboard into rows with accuracy chips and ok/info/muted tones', () => {
    const signal = makeSignal({
      template_id: 'tbench-leaderboard',
      points: [
        {
          dimensions: {
            metric: 'leaderboard_entry',
            rank: 1,
            agent: 'Codex CLI',
            model: 'GPT-5.5',
            agent_org: 'OpenAI',
          },
          value: 83.4,
          unit: '%',
          source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
        },
        {
          dimensions: {
            metric: 'leaderboard_entry',
            rank: 2,
            agent: 'Terminus 2',
            model: 'Gemini 3 Pro',
            agent_org: 'TerminalBench',
          },
          value: 74.4,
          unit: '%',
          source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
        },
        {
          dimensions: {
            metric: 'leaderboard_entry',
            rank: 3,
            agent: 'Some Agent',
            model: 'Old Model',
            agent_org: 'Org',
          },
          value: 60.0,
          unit: '%',
          source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);

    const first = out?.rows[0];
    expect(first?.title).toBe('Codex CLI');
    expect(first?.subtitle).toBe('GPT-5.5');
    expect(first?.chip).toBe('83.4%');
    expect(first?.chipTone).toBe('ok');
    expect(first?.href).toBe('https://www.tbench.ai/leaderboard/terminal-bench/2.1');

    expect(out?.rows[1]?.chipTone).toBe('info');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 verified');
  });

  it('shapes sector-movers into all 11 rows with signed-percent chips and ok/urgent tones', () => {
    const signal = makeSignal({
      template_id: 'sector-movers',
      points: [
        ...Array.from({ length: 11 }, (_, i) => ({
          dimensions: {
            metric: 'sector_change',
            ticker: `T${String(i + 1)}`,
            sector: `Sector${String(i + 1)}`,
            rank: String(i + 1),
          },
          value: 2 - i * 0.5,
          unit: '%',
        })),
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(11);
    expect(out?.rows[0]?.title).toBe('Sector1');
    expect(out?.rows[0]?.subtitle).toBe('T1');
    expect(out?.rows[0]?.chip).toBe('+2.00%');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[4]?.chip).toBe('0.00%');
    expect(out?.rows[4]?.chipTone).toBe('muted');
    expect(out?.rows[10]?.chip).toBe('-3.00%');
    expect(out?.rows[10]?.chipTone).toBe('urgent');
    expect(out?.summary).toBe('4 up · 6 down');
  });

  it('shapes karpathy-jobs-snapshot top_role points into rows with exposure chips and ok/info/warn tones', () => {
    const signal = makeSignal({
      template_id: 'karpathy-jobs-snapshot',
      points: [
        {
          dimensions: { metric: 'high_exposure_share' },
          value: '42%',
          source_url: 'https://karpathy.ai/jobs/',
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 1,
            category: 'Computer & mathematical',
            jobs: 4_800_000,
            exposure: 72,
          },
          value: 'Software developers',
          source_url: 'https://karpathy.ai/jobs/role/dev',
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 2,
            category: 'Office & admin',
            jobs: 120_000,
            exposure: 45,
          },
          value: 'Bookkeepers',
          source_url: 'https://karpathy.ai/jobs/role/bk',
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 3,
            category: 'Healthcare support',
            jobs: 850,
            exposure: 18,
          },
          value: 'Home health aides',
          source_url: 'https://karpathy.ai/jobs/role/aide',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);

    const first = out?.rows[0];
    expect(first?.title).toBe('Computer & mathematical');
    expect(first?.subtitle).toBe('5M jobs');
    expect(first?.chip).toBe('72%');
    expect(first?.chipTone).toBe('warn');
    expect(first?.href).toBe('https://karpathy.ai/jobs/role/dev');

    expect(out?.rows[1]?.subtitle).toBe('120k jobs');
    expect(out?.rows[1]?.chip).toBe('45%');
    expect(out?.rows[1]?.chipTone).toBe('info');

    expect(out?.rows[2]?.subtitle).toBe('850 jobs');
    expect(out?.rows[2]?.chip).toBe('18%');
    expect(out?.rows[2]?.chipTone).toBe('ok');

    expect(out?.summary).toBe('Top 3 most exposed');
  });

  it('shapes market-overview into proxy rows with signed-percent chips and a regime summary', () => {
    const signal = makeSignal({
      template_id: 'market-overview',
      points: [
        {
          dimensions: {
            metric: 'market_regime',
            risk_score: 2,
            positive_count: 4,
            negative_count: 1,
          },
          value: 'risk-on',
          source_url: 'https://stooq.com/',
        },
        {
          dimensions: {
            metric: 'market_proxy_change',
            ticker: 'spy.us',
            label: 'S&P 500',
            role: 'equities',
          },
          value: 1.24,
          unit: '%',
          source_url: 'https://stooq.com/q/?s=spy.us',
        },
        {
          dimensions: {
            metric: 'market_proxy_change',
            ticker: 'tlt.us',
            label: '20Y Treasuries',
            role: 'bonds',
          },
          value: -0.42,
          unit: '%',
          source_url: 'https://stooq.com/q/?s=tlt.us',
        },
        {
          dimensions: {
            metric: 'market_proxy_change',
            ticker: 'flat.us',
            label: 'Flat',
            role: 'cash',
          },
          value: 0,
          unit: '%',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);

    const first = out?.rows[0];
    expect(first?.title).toBe('S&P 500');
    expect(first?.subtitle).toBe('spy.us · equities');
    expect(first?.chip).toBe('+1.24%');
    expect(first?.chipTone).toBe('ok');
    expect(first?.href).toBe('https://stooq.com/q/?s=spy.us');

    expect(out?.rows[1]?.chip).toBe('-0.42%');
    expect(out?.rows[1]?.chipTone).toBe('urgent');
    expect(out?.rows[2]?.chipTone).toBe('muted');

    expect(out?.summary).toBe('Risk-on · 4 up · 1 down');
  });

  it('limits karpathy-jobs-snapshot to top 3 by rank, sorted ascending', () => {
    const signal = makeSignal({
      template_id: 'karpathy-jobs-snapshot',
      points: Array.from({ length: 5 }, (_, i) => ({
        dimensions: {
          metric: 'top_role',
          rank: 5 - i,
          category: `Cat${String(5 - i)}`,
          jobs: 10_000,
          exposure: 50,
        },
        value: `Role ${String(5 - i)}`,
      })),
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows).toHaveLength(3);
    expect(out?.rows.map((r) => r.title)).toEqual(['Cat1', 'Cat2', 'Cat3']);
  });
});

describe('signalTitle', () => {
  it('prefers server-resolved display titles when available', () => {
    expect(
      signalTitle(
        makeSignal({
          template_id: 'fx-pair',
          config: { base: 'EUR', quote: 'USD' },
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('Server title');
  });

  it('uses macro preset labels for free macro history signals', () => {
    expect(
      signalTitle(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'gbp-usd' } }),
      ),
    ).toBe('GBP/USD 1Y');
  });
});

describe('signalSourceLabel', () => {
  it('prefers server-resolved source labels when available', () => {
    expect(
      signalSourceLabel(
        makeSignal({
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('Server source');
  });

  it('uses the concrete source label for macro presets', () => {
    expect(
      signalSourceLabel(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'uk-10y-gilt' } }),
      ),
    ).toBe('Bank of England');
    expect(
      signalSourceLabel(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'crude-oil' } }),
      ),
    ).toBe('EIA');
  });
});

describe('signalSourceUrl', () => {
  it('prefers server-resolved source URLs when available', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('https://example.test/source');
  });

  it('drops executable signal links', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          template_id: 'rest-metric',
          config: { url: 'javascript:alert(1)' },
          display: { title: 'Unsafe', source_label: 'Unsafe', source_url: 'javascript:alert(1)' },
        }),
      ),
    ).toBeNull();
  });

  it('returns the first point source URL when present', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          points: [
            { dimensions: { label: 'A' }, value: 1, ts: 0 },
            {
              dimensions: { label: 'B' },
              value: 2,
              ts: 0,
              source_url: 'https://example.test/source',
            },
          ],
        }),
      ),
    ).toBe('https://example.test/source');
  });

  it('falls back to source config and known template source pages', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          template_id: 'trading-economics-market',
          config: { sourceUrl: 'https://tradingeconomics.com/commodity/gold' },
        }),
      ),
    ).toBe('https://tradingeconomics.com/commodity/gold');
    expect(
      signalSourceUrl(makeSignal({ template_id: 'market-history', config: { symbol: 'AZN.L' } })),
    ).toBe('https://finance.yahoo.com/quote/AZN.L/');
    expect(
      signalSourceUrl(makeSignal({ template_id: 'crypto-history', config: { pairs: 'BTC-USD' } })),
    ).toBe('https://www.coinbase.com/price/btc');
    expect(
      signalSourceUrl(
        makeSignal({ template_id: 'macro-market-history', config: { preset: 'crude-oil' } }),
      ),
    ).toBe('https://www.eia.gov/dnav/pet/hist/RWTCd.htm');
  });
});

function makeSignal(overrides: Partial<ApiSignal> = {}): ApiSignal {
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
