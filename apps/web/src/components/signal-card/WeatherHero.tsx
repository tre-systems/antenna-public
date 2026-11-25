import type { WeatherCardData, WeatherCondition } from '../../signal-format';
import { WeatherIcon } from '../WeatherIcon';
import { WeatherDailyStrip } from './WeatherDailyStrip';
import { WeatherHourlyChart } from './WeatherHourlyChart';
import { weatherIconTint } from './weather-tint';

export function WeatherHero({ data }: { readonly data: WeatherCardData }) {
  const showApparent =
    data.apparentTemp !== null && Math.abs(data.apparentTemp - parseFloat(data.tempText)) >= 1.5;

  return (
    <div class="mt-5" data-testid="weather-hero">
      <div class="flex items-baseline gap-3">
        {data.condition ? <WeatherConditionIcon condition={data.condition} data={data} /> : null}
        <span class="text-4xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {data.tempText}
        </span>
        <span class="text-base text-slate-500 dark:text-slate-400">{data.tempUnit}</span>
        <span class="text-sm text-slate-600 dark:text-slate-300">{data.tempDescriptor}</span>
      </div>
      <WeatherDescriptors data={data} showApparent={showApparent} />
      <WeatherHourlyChart forecast={data.forecast} />
      <WeatherDailyStrip daily={data.daily} />
      <p
        class="mt-3 rounded-md bg-sky-50/70 px-2 py-1.5 text-xs text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
        data-testid="weather-advice"
      >
        {data.advice}
      </p>
    </div>
  );
}

function WeatherConditionIcon({
  condition,
  data,
}: {
  readonly condition: WeatherCondition;
  readonly data: WeatherCardData;
}) {
  return (
    <span
      class={`flex h-8 w-8 shrink-0 items-center justify-center ${weatherIconTint(condition, data.isDay)}`}
      data-testid="weather-condition-icon"
    >
      <WeatherIcon condition={condition} className="h-8 w-8" title={condition} />
    </span>
  );
}

function WeatherDescriptors({
  data,
  showApparent,
}: {
  readonly data: WeatherCardData;
  readonly showApparent: boolean;
}) {
  return (
    <p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      <span class="text-slate-700 dark:text-slate-300">{data.windDescriptor}</span> ·{' '}
      <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.windSpeed}</span>{' '}
      {data.windUnit} · humidity{' '}
      <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.humidity}</span>
      {showApparent ? ` · feels ${data.apparentTemp?.toFixed(1)}${data.tempUnit}` : ''}
    </p>
  );
}
