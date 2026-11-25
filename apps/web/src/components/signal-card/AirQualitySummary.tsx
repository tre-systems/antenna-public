import type { AirQualityCardData } from '../../signal-format';
import { AirQualityTrendChart } from './AirQualityTrendChart';

// Collapsed-card view: banded AQI reading plus a compact 48-hour trendline.
export function AirQualitySummary({ data }: { readonly data: AirQualityCardData }) {
  return (
    <div class="mt-2" data-testid="airquality-summary">
      <p class="flex items-baseline gap-1.5">
        <span class={`text-2xl font-semibold tracking-tight tabular-nums ${data.band.textClass}`}>
          {data.aqiText}
        </span>
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">EAQI</span>
        <span class={`text-xs font-medium ${data.band.textClass}`}>{data.band.label}</span>
      </p>
      <AirQualityTrendChart trend={data.trend} color={data.band.markerFill} compact />
    </div>
  );
}
