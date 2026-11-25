import type { WeatherCondition } from '../../signal-format';

export const weatherIconTint = (condition: WeatherCondition, isDay: boolean | null): string => {
  if (isDay === false) return 'text-indigo-400 dark:text-indigo-300';
  if (condition === 'clear' || condition === 'partly-cloudy') {
    return 'text-amber-500 dark:text-amber-400';
  }
  if (condition === 'rain' || condition === 'drizzle' || condition === 'thunderstorm') {
    return 'text-sky-600 dark:text-sky-300';
  }
  return 'text-slate-500 dark:text-slate-400';
};
