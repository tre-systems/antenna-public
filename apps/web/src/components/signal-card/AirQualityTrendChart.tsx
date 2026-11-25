import type { AirQualityTrendPoint } from '../../signal-format';

const W = 264;
const PAD_X = 8;
const GUIDES = [20, 40, 60, 80];

type Scales = {
  readonly x: (hour: number) => number;
  readonly y: (aqi: number) => number;
  readonly yMax: number;
};

type Props = {
  readonly trend: ReadonlyArray<AirQualityTrendPoint>;
  readonly color: string;
  readonly compact?: boolean;
};

// Observed hours (≤ 0) draw solid; forecast hours draw dashed.
export function AirQualityTrendChart({ trend, color, compact = false }: Props) {
  const first = trend[0];
  const last = trend[trend.length - 1];
  if (!first || !last || first.hour === last.hour) return null;

  const H = compact ? 40 : 76;
  const top = 6;
  const bottom = compact ? H - 4 : H - 14;
  const scales = buildScales(trend, first.hour, last.hour, top, bottom);
  const past = trend.filter((t) => t.hour <= 0);
  const future = trend.filter((t) => t.hour >= 0);
  const now = nearestToNow(trend);

  return (
    <svg
      viewBox={`0 0 ${W} ${String(H)}`}
      class={`mt-3 block w-full ${compact ? '' : 'max-w-md'}`}
      role="img"
      aria-label="Air quality index over the past 24 hours and forecast for the next 24 hours"
      data-testid="airquality-trend"
    >
      <Guides scales={scales} bottom={bottom} compact={compact} />
      <path
        d={`${linePath(trend, scales)} L${scales.x(last.hour).toFixed(1)},${String(bottom)} L${scales.x(first.hour).toFixed(1)},${String(bottom)} Z`}
        fill={color}
        opacity="0.08"
      />
      {past.length >= 2 ? (
        <path
          d={linePath(past, scales)}
          fill="none"
          stroke={color}
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      ) : null}
      {future.length >= 2 ? (
        <path
          d={linePath(future, scales)}
          fill="none"
          stroke={color}
          stroke-width="1.5"
          stroke-dasharray="3 3"
          opacity="0.65"
          stroke-linejoin="round"
        />
      ) : null}
      {now ? (
        <circle
          cx={scales.x(now.hour)}
          cy={scales.y(now.aqi)}
          r="3"
          fill={color}
          stroke-width="1.5"
          class="stroke-white dark:stroke-slate-900"
        />
      ) : null}
      {compact ? null : (
        <AxisLabels firstHour={first.hour} lastHour={last.hour} scales={scales} h={H} />
      )}
    </svg>
  );
}

const buildScales = (
  trend: ReadonlyArray<AirQualityTrendPoint>,
  firstHour: number,
  lastHour: number,
  top: number,
  bottom: number,
): Scales => {
  const yMax = Math.max(60, ...trend.map((t) => t.aqi + 10));
  return {
    x: (hour: number) => PAD_X + ((hour - firstHour) / (lastHour - firstHour)) * (W - 2 * PAD_X),
    y: (aqi: number) => bottom - (aqi / yMax) * (bottom - top),
    yMax,
  };
};

const linePath = (points: ReadonlyArray<AirQualityTrendPoint>, scales: Scales): string =>
  points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${scales.x(p.hour).toFixed(1)},${scales.y(p.aqi).toFixed(1)}`,
    )
    .join(' ');

const nearestToNow = (trend: ReadonlyArray<AirQualityTrendPoint>): AirQualityTrendPoint | null =>
  trend.reduce<AirQualityTrendPoint | null>(
    (best, t) => (best === null || Math.abs(t.hour) < Math.abs(best.hour) ? t : best),
    null,
  );

function Guides({
  scales,
  bottom,
  compact,
}: {
  readonly scales: Scales;
  readonly bottom: number;
  readonly compact: boolean;
}) {
  const shown = GUIDES.filter((g) => g < scales.yMax * 0.95);
  return (
    <g>
      {shown.map((g) => (
        <g key={g}>
          <line
            x1={PAD_X}
            y1={scales.y(g)}
            x2={W - PAD_X}
            y2={scales.y(g)}
            class="stroke-slate-900/[0.06] dark:stroke-white/10"
          />
          {compact ? null : (
            <text
              x={W - PAD_X}
              y={scales.y(g) - 2}
              text-anchor="end"
              class="fill-slate-400/80 text-[8px] tabular-nums dark:fill-slate-500/80"
            >
              {g}
            </text>
          )}
        </g>
      ))}
      <line
        x1={PAD_X}
        y1={bottom}
        x2={W - PAD_X}
        y2={bottom}
        class="stroke-slate-900/10 dark:stroke-white/10"
      />
    </g>
  );
}

function AxisLabels({
  firstHour,
  lastHour,
  scales,
  h,
}: {
  readonly firstHour: number;
  readonly lastHour: number;
  readonly scales: Scales;
  readonly h: number;
}) {
  return (
    <g class="fill-slate-400 text-[9px] tabular-nums dark:fill-slate-500">
      <text x={PAD_X} y={h - 3} text-anchor="start">{`${String(firstHour)}h`}</text>
      <text x={scales.x(0)} y={h - 3} text-anchor="middle">
        now
      </text>
      <text x={W - PAD_X} y={h - 3} text-anchor="end">{`+${String(lastHour)}h`}</text>
    </g>
  );
}
