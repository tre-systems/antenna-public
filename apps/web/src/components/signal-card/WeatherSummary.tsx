import type { WeatherCardData } from '../../signal-format';
import { WeatherIcon } from '../WeatherIcon';
import { WeatherDailyStrip } from './WeatherDailyStrip';
import { weatherIconTint } from './weather-tint';

// Collapsed-card view: current conditions at a glance plus the multi-day outlook.
export function WeatherSummary({ data }: { readonly data: WeatherCardData }) {
  return (
    <div class="mt-2" data-testid="weather-summary">
      <div class="flex items-baseline gap-2">
        {data.condition ? (
          <span
            class={`flex h-6 w-6 shrink-0 items-center justify-center self-center ${weatherIconTint(data.condition, data.isDay)}`}
          >
            <WeatherIcon condition={data.condition} className="h-6 w-6" title={data.condition} />
          </span>
        ) : null}
        <span class="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {data.tempText}
        </span>
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{data.tempUnit}</span>
        <span class="text-xs text-slate-600 dark:text-slate-300">{data.tempDescriptor}</span>
      </div>
      <WeatherDailyStrip daily={data.daily} compact />
    </div>
  );
}
