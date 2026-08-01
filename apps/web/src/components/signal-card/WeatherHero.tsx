import {
  forecastHourLabel,
  type WeatherCardData,
  type WeatherCondition,
  type WeatherForecastHour,
} from '../../signal-format';
import { WeatherIcon } from '../WeatherIcon';

export function WeatherHero({ data }: { readonly data: WeatherCardData }) {
  const showForecast = data.forecast.length > 0;
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
      {showForecast ? <ForecastStrip forecast={data.forecast} /> : null}
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
      class={`flex h-8 w-8 shrink-0 items-center justify-center ${conditionIconClass(data, condition)}`}
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

function ForecastStrip({ forecast }: { readonly forecast: ReadonlyArray<WeatherForecastHour> }) {
  return (
    <div
      class="mt-4 -mx-1 flex items-end gap-0.5 overflow-x-auto px-1"
      data-testid="weather-forecast"
    >
      {forecast.map((hour) => (
        <ForecastColumn key={hour.hourOffset} hour={hour} />
      ))}
    </div>
  );
}

function ForecastColumn({ hour }: { readonly hour: WeatherForecastHour }) {
  const label = forecastHourLabel(hour);
  const rainPct = hour.rainProb ?? 0;
  const barHeightPx = 2 + Math.round((Math.max(0, Math.min(100, rainPct)) / 100) * 16);
  const barOpacity = rainPct > 0 ? Math.max(0.25, Math.min(1, rainPct / 100)) : 0.15;

  return (
    <div
      class="flex min-w-[1.75rem] flex-1 flex-col items-center gap-1 rounded-md py-1 text-[10px] tabular-nums text-slate-500 dark:text-slate-400"
      data-testid="forecast-hour"
      data-hour-offset={hour.hourOffset}
    >
      <span>{label}</span>
      <span class="text-[11px] font-medium text-slate-700 dark:text-slate-200">
        {Math.round(hour.temp)}°
      </span>
      <span
        aria-hidden="true"
        class="block w-1.5 rounded-full bg-sky-500 dark:bg-sky-400"
        style={`height:${String(barHeightPx)}px;opacity:${barOpacity.toFixed(2)};`}
      />
      <span class="text-[9px] text-sky-600/70 dark:text-sky-300/70">
        {rainPct > 0 ? `${String(Math.round(rainPct))}%` : '—'}
      </span>
    </div>
  );
}

function conditionIconClass(data: WeatherCardData, condition: WeatherCondition): string {
  if (data.isDay === false) return 'text-indigo-400 dark:text-indigo-300';
  if (condition === 'clear' || condition === 'partly-cloudy') {
    return 'text-amber-500 dark:text-amber-400';
  }
  if (condition === 'rain' || condition === 'drizzle' || condition === 'thunderstorm') {
    return 'text-sky-600 dark:text-sky-300';
  }
  return 'text-slate-500 dark:text-slate-400';
}
