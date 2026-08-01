import type { AirQualityCardData } from '../../signal-format';

export function AirQualityHero({ data }: { readonly data: AirQualityCardData }) {
  return (
    <div class="mt-5" data-testid="airquality-hero">
      <div class="flex items-baseline gap-3">
        <span class={`text-4xl font-semibold tracking-tight tabular-nums ${data.band.textClass}`}>
          {data.aqiText}
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">EAQI</span>
        <span class={`text-sm font-medium ${data.band.textClass}`}>{data.band.label}</span>
      </div>
      <AirQualityGauge data={data} />
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{data.band.health}</p>
      <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        PM2.5 <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.pm25}</span> µg/m³
        · PM10 <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.pm10}</span>{' '}
        µg/m³
      </p>
    </div>
  );
}

function AirQualityGauge({ data }: { readonly data: AirQualityCardData }) {
  return (
    <div class="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/10">
      <div
        aria-hidden="true"
        class="absolute inset-0 rounded-full opacity-90"
        style="background: linear-gradient(to right, #10b981 0%, #84cc16 20%, #eab308 40%, #f97316 60%, #ef4444 80%, #c026d3 100%);"
      />
      <div
        aria-hidden="true"
        class={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ${data.band.ringClass} shadow-sm dark:bg-slate-900`}
        style={`left: ${String(data.markerPct)}%;`}
      />
    </div>
  );
}
