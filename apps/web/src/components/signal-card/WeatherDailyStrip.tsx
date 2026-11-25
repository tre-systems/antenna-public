import { forecastDayLabel, type WeatherForecastDay } from '../../signal-format';
import { WeatherIcon } from '../WeatherIcon';
import { weatherIconTint } from './weather-tint';

type Props = {
  readonly daily: ReadonlyArray<WeatherForecastDay>;
  readonly compact?: boolean;
};

export function WeatherDailyStrip({ daily, compact = false }: Props) {
  if (daily.length === 0) return null;
  return (
    <div
      class={`${compact ? 'mt-3' : 'mt-4'} grid gap-1`}
      style={`grid-template-columns: repeat(${String(daily.length)}, minmax(0, 1fr));`}
      data-testid="weather-daily"
    >
      {daily.map((day) => (
        <DayColumn key={day.dayOffset} day={day} compact={compact} />
      ))}
    </div>
  );
}

function DayColumn({
  day,
  compact,
}: {
  readonly day: WeatherForecastDay;
  readonly compact: boolean;
}) {
  return (
    <div
      class={`flex flex-col items-center rounded-lg bg-slate-900/[0.03] px-0.5 dark:bg-white/[0.04] ${
        compact ? 'gap-0.5 py-1' : 'gap-1 py-1.5'
      }`}
      data-day-offset={day.dayOffset}
    >
      <span class="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {forecastDayLabel(day)}
      </span>
      <span class={`flex items-center justify-center ${weatherIconTint(day.condition, true)}`}>
        <WeatherIcon
          condition={day.condition}
          className={compact ? 'h-4 w-4' : 'h-5 w-5'}
          title={day.condition}
        />
      </span>
      <span class="text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {Math.round(day.tempMax)}°
      </span>
      {compact ? null : <DayDetail day={day} />}
    </div>
  );
}

function DayDetail({ day }: { readonly day: WeatherForecastDay }) {
  const rain = day.rainProb;
  return (
    <>
      <span class="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        {Math.round(day.tempMin)}°
      </span>
      <span class="text-[9px] tabular-nums text-sky-600/80 dark:text-sky-300/70">
        {rain !== null && rain > 0 ? `${String(Math.round(rain))}%` : '—'}
      </span>
    </>
  );
}
