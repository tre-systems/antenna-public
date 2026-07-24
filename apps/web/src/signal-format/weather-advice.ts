import { fixed1 } from './common';
import { forecastHourLabel, peakRainHour } from './weather-forecast';
import type { WeatherForecastHour } from './weather-types';

type WeatherAdviceInput = {
  apparentTemp: number | null;
  precipitation: number | null;
  uvIndex: number | null;
  isDay: boolean | null;
  forecast: ReadonlyArray<WeatherForecastHour>;
};

export const deriveWeatherAdvice = (input: WeatherAdviceInput): string => {
  const peak = peakRainHour(input.forecast);
  const wetNow = (input.precipitation ?? 0) > 0;
  if (peak && peak.pct >= 50 && wetNow) {
    return `Bring an umbrella — ${String(Math.round(peak.pct))}% rain at ${forecastHourLabel(peak.hour)}`;
  }
  if (input.apparentTemp !== null && input.apparentTemp < 5) {
    return `Wear a coat — feels like ${fixed1(input.apparentTemp)}°C`;
  }
  if (input.apparentTemp !== null && input.apparentTemp > 28) {
    return `Stay cool — feels like ${fixed1(input.apparentTemp)}°C`;
  }
  if (input.uvIndex !== null && input.uvIndex >= 7 && input.isDay === true) {
    return 'High UV — sunscreen if outside';
  }
  return 'Pleasant conditions';
};
