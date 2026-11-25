import { forecastHourLabel, type WeatherForecastHour } from '../../signal-format';

const W = 264;
const H = 84;
const PAD_X = 10;
const TEMP_TOP = 14;
const TEMP_BOTTOM = 50;
const RAIN_BASE = 66;
const RAIN_MAX = 14;
const LABEL_Y = 81;

type Slot = { readonly hour: WeatherForecastHour; readonly x: number };

export function WeatherHourlyChart({
  forecast,
}: {
  readonly forecast: ReadonlyArray<WeatherForecastHour>;
}) {
  if (forecast.length < 2) return null;
  const n = forecast.length;
  const slots: Slot[] = forecast.map((hour, i) => ({
    hour,
    x: PAD_X + (i * (W - 2 * PAD_X)) / (n - 1),
  }));
  const y = tempScale(forecast);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      class="mt-4 block w-full max-w-md"
      role="img"
      aria-label="Next 12 hours: temperature curve and rain probability bars"
      data-testid="weather-forecast"
    >
      <path
        d={`${tempLine(slots, y)} ${areaClose(slots)}`}
        class="fill-amber-500/10 dark:fill-amber-400/10"
      />
      <path
        d={tempLine(slots, y)}
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="stroke-amber-500 dark:stroke-amber-400"
      />
      <TempExtremes slots={slots} y={y} />
      <line
        x1={PAD_X - 4}
        y1={RAIN_BASE}
        x2={W - PAD_X + 4}
        y2={RAIN_BASE}
        class="stroke-slate-900/10 dark:stroke-white/10"
      />
      {slots.map((slot, i) => (
        <HourSlot key={slot.hour.hourOffset} slot={slot} labelled={i % 2 === 0} />
      ))}
      <PeakRainLabel slots={slots} />
    </svg>
  );
}

const tempScale = (forecast: ReadonlyArray<WeatherForecastHour>): ((t: number) => number) => {
  const temps = forecast.map((h) => h.temp);
  let min = Math.min(...temps);
  let max = Math.max(...temps);
  if (max - min < 2) {
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  return (t: number) => TEMP_BOTTOM - ((t - min) / (max - min)) * (TEMP_BOTTOM - TEMP_TOP);
};

const tempLine = (slots: ReadonlyArray<Slot>, y: (t: number) => number): string =>
  slots
    .map((slot, i) => `${i === 0 ? 'M' : 'L'}${slot.x.toFixed(1)},${y(slot.hour.temp).toFixed(1)}`)
    .join(' ');

const areaClose = (slots: ReadonlyArray<Slot>): string => {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || !last) return '';
  return `L${last.x.toFixed(1)},${TEMP_BOTTOM} L${first.x.toFixed(1)},${TEMP_BOTTOM} Z`;
};

function TempExtremes({
  slots,
  y,
}: {
  readonly slots: ReadonlyArray<Slot>;
  readonly y: (t: number) => number;
}) {
  const warmest = slots.reduce((a, b) => (b.hour.temp > a.hour.temp ? b : a));
  const coolest = slots.reduce((a, b) => (b.hour.temp < a.hour.temp ? b : a));
  const marks = warmest === coolest ? [warmest] : [warmest, coolest];
  return (
    <g class="fill-slate-600 text-[9px] font-medium tabular-nums dark:fill-slate-300">
      {marks.map((slot) => (
        <text
          key={slot.hour.hourOffset}
          x={clampX(slot.x)}
          y={y(slot.hour.temp) - 4}
          text-anchor="middle"
        >
          {Math.round(slot.hour.temp)}°
        </text>
      ))}
    </g>
  );
}

function HourSlot({ slot, labelled }: { readonly slot: Slot; readonly labelled: boolean }) {
  const pct = Math.max(0, Math.min(100, slot.hour.rainProb ?? 0));
  const barHeight = Math.max(1.5, (pct / 100) * RAIN_MAX);
  return (
    <g data-hour-offset={slot.hour.hourOffset}>
      <rect
        x={slot.x - 3.5}
        y={RAIN_BASE - barHeight}
        width="7"
        height={barHeight}
        rx="1.5"
        opacity={pct > 0 ? Math.max(0.3, pct / 100) : 0.12}
        class="fill-sky-500 dark:fill-sky-400"
      />
      {labelled ? (
        <text
          x={clampX(slot.x)}
          y={LABEL_Y}
          text-anchor="middle"
          class="fill-slate-400 text-[9px] tabular-nums dark:fill-slate-500"
        >
          {forecastHourLabel(slot.hour)}
        </text>
      ) : null}
    </g>
  );
}

function PeakRainLabel({ slots }: { readonly slots: ReadonlyArray<Slot> }) {
  const peak = slots.reduce((a, b) => ((b.hour.rainProb ?? 0) > (a.hour.rainProb ?? 0) ? b : a));
  const pct = peak.hour.rainProb ?? 0;
  if (pct < 20) return null;
  return (
    <text
      x={clampX(peak.x)}
      y={RAIN_BASE - (pct / 100) * RAIN_MAX - 3}
      text-anchor="middle"
      class="fill-sky-600/90 text-[8px] font-medium tabular-nums dark:fill-sky-300/90"
    >
      {Math.round(pct)}%
    </text>
  );
}

const clampX = (x: number): number => Math.max(12, Math.min(W - 12, x));
