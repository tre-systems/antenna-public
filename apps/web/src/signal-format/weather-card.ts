import type { DataPoint } from '../api';
import { fixed1 } from './common';
import type { RenderSignal } from './types';
import { deriveWeatherAdvice } from './weather-advice';
import { weatherCondition } from './weather-conditions';
import { extractForecast } from './weather-forecast';
import type { WeatherCardData, WeatherCondition } from './weather-types';

type MetricFinder = (metric: string) => DataPoint | undefined;

type CurrentWeatherFields = {
  weatherCode: number | null;
  apparentTemp: number | null;
  precipitation: number | null;
  uvIndex: number | null;
  isDay: boolean | null;
  condition: WeatherCondition | null;
};

export function weatherCardData(signal: RenderSignal): WeatherCardData | null {
  if (signal.template_id !== 'weather') return null;
  if (signal.points.length === 0) return null;
  const find = metricFinder(signal.points);
  const temp = find('temperature');
  if (!temp || typeof temp.value !== 'number') return null;
  const wind = find('wind');
  const fields = currentWeatherFields(find);
  const forecast = extractForecast(signal.points);
  return weatherData(temp, wind, find('humidity'), fields, forecast);
}

const metricFinder =
  (points: ReadonlyArray<DataPoint>): MetricFinder =>
  (metric: string): DataPoint | undefined =>
    points.find((p) => p.dimensions?.metric === metric);

const currentWeatherFields = (find: MetricFinder): CurrentWeatherFields => {
  const weatherCode = numberMetric(find, 'weather_code');
  const isDayValue = numberMetric(find, 'is_day');
  return {
    weatherCode,
    apparentTemp: numberMetric(find, 'feels_like'),
    precipitation: numberMetric(find, 'precipitation'),
    uvIndex: numberMetric(find, 'uv_index'),
    isDay: isDayValue === null ? null : isDayValue === 1,
    condition: weatherCode !== null ? weatherCondition(weatherCode) : null,
  };
};

const numberMetric = (find: MetricFinder, metric: string): number | null => {
  const point = find(metric);
  return point && typeof point.value === 'number' ? point.value : null;
};

const weatherData = (
  temp: DataPoint,
  wind: DataPoint | undefined,
  humidity: DataPoint | undefined,
  fields: CurrentWeatherFields,
  forecast: WeatherCardData['forecast'],
): WeatherCardData => {
  const windNum = typeof wind?.value === 'number' ? wind.value : null;
  return {
    tempText: fixed1(temp.value as number),
    tempUnit: temp.unit ?? '°C',
    tempDescriptor: tempDescriptor(temp.value as number),
    windDescriptor: windNum !== null ? windDescriptor(windNum) : '—',
    humidity: humidity && typeof humidity.value === 'number' ? `${humidity.value}%` : '—',
    windSpeed: windNum !== null ? fixed1(windNum) : '—',
    windUnit: wind?.unit ?? 'm/s',
    ...fields,
    feelsLikeC: fields.apparentTemp,
    forecast,
    advice: deriveWeatherAdvice({ ...fields, forecast }),
  };
};

const tempDescriptor = (c: number): string => {
  if (c < 0) return 'Freezing';
  if (c < 10) return 'Cold';
  if (c < 18) return 'Mild';
  if (c < 25) return 'Warm';
  if (c < 32) return 'Hot';
  return 'Very hot';
};

const windDescriptor = (ms: number): string => {
  if (ms < 1.5) return 'Calm';
  if (ms < 5.5) return 'Light breeze';
  if (ms < 8) return 'Moderate breeze';
  if (ms < 10.8) return 'Fresh breeze';
  if (ms < 13.9) return 'Strong breeze';
  if (ms < 17.2) return 'Near gale';
  if (ms < 20.8) return 'Gale';
  return 'Storm';
};
