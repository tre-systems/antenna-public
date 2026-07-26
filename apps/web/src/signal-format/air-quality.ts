import type { DataPoint } from '../api';
import { fixed1 } from './common';
import type { RenderSignal } from './types';

type AqiBand = {
  readonly label: string;
  readonly health: string;
  readonly textClass: string;
  readonly ringClass: string;
  readonly markerFill: string;
};

const AQI_BANDS: ReadonlyArray<{ max: number } & AqiBand> = [
  {
    max: 20,
    label: 'Very good',
    health: 'No precautions needed',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    ringClass: 'ring-emerald-500/40',
    markerFill: '#10b981',
  },
  {
    max: 40,
    label: 'Good',
    health: 'Air quality is acceptable',
    textClass: 'text-lime-600 dark:text-lime-400',
    ringClass: 'ring-lime-500/40',
    markerFill: '#84cc16',
  },
  {
    max: 60,
    label: 'Moderate',
    health: 'Unusually sensitive people may notice symptoms',
    textClass: 'text-yellow-600 dark:text-yellow-400',
    ringClass: 'ring-yellow-500/40',
    markerFill: '#eab308',
  },
  {
    max: 80,
    label: 'Poor',
    health: 'Sensitive groups should reduce outdoor exertion',
    textClass: 'text-orange-600 dark:text-orange-400',
    ringClass: 'ring-orange-500/40',
    markerFill: '#f97316',
  },
  {
    max: 100,
    label: 'Very poor',
    health: 'Reduce prolonged outdoor exertion',
    textClass: 'text-rose-600 dark:text-rose-400',
    ringClass: 'ring-rose-500/40',
    markerFill: '#ef4444',
  },
  {
    max: Number.POSITIVE_INFINITY,
    label: 'Extremely poor',
    health: 'Avoid outdoor exertion',
    textClass: 'text-fuchsia-700 dark:text-fuchsia-300',
    ringClass: 'ring-fuchsia-500/40',
    markerFill: '#c026d3',
  },
];

export function aqiBand(value: number): AqiBand {
  const band = AQI_BANDS.find((b) => value < b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
  if (!band) throw new Error('AQI_BANDS is empty — should be unreachable');
  return band;
}

export type AirQualityCardData = {
  readonly aqi: number;
  readonly aqiText: string;
  readonly band: AqiBand;
  readonly markerPct: number;
  readonly pm25: string;
  readonly pm10: string;
};

export function airQualityCardData(signal: RenderSignal): AirQualityCardData | null {
  if (signal.template_id !== 'airquality') return null;
  if (signal.points.length === 0) return null;
  const find = metricFinder(signal.points);
  const aqi = find('aqi');
  if (!aqi || typeof aqi.value !== 'number') return null;
  return airQualityData(aqi.value, find('pm2_5'), find('pm10'));
}

const metricFinder =
  (points: ReadonlyArray<DataPoint>) =>
  (metric: string): DataPoint | undefined =>
    points.find((p) => p.dimensions?.metric === metric);

const airQualityData = (
  aqi: number,
  pm25: DataPoint | undefined,
  pm10: DataPoint | undefined,
): AirQualityCardData => ({
  aqi,
  aqiText: String(Math.round(aqi)),
  band: aqiBand(aqi),
  markerPct: Math.min(100, Math.max(0, aqi)),
  pm25: pm25 && typeof pm25.value === 'number' ? fixed1(pm25.value) : '—',
  pm10: pm10 && typeof pm10.value === 'number' ? fixed1(pm10.value) : '—',
});
