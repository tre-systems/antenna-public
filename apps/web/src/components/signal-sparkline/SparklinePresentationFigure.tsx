import { useMemo } from 'preact/hooks';
import { changeColour, percentChange } from './labels';
import { sparklinePath, sortSeries } from './geometry';
import { DEFAULT_SPARKLINE_RANGE, filterSeriesForRange, sparklineRangeLabel } from './ranges';
import { SPARKLINE_HEIGHT, SPARKLINE_PAD, SPARKLINE_WIDTH } from './types';
import type { SeriesPoint } from './types';

type SparklinePresentationFigureProps = {
  readonly label: string;
  readonly points: readonly SeriesPoint[];
};

export function SparklinePresentationFigure({ label, points }: SparklinePresentationFigureProps) {
  const fullSeries = useMemo(() => sortSeries(points), [points]);
  const visibleSeries = useMemo(
    () => filterSeriesForRange(fullSeries, DEFAULT_SPARKLINE_RANGE),
    [fullSeries],
  );
  const path = useMemo(() => sparklinePath(visibleSeries), [visibleSeries]);
  const change = percentChange(visibleSeries);
  const changeStyle = changeColour(change);
  const rangeLabel = sparklineRangeLabel(DEFAULT_SPARKLINE_RANGE);

  return (
    <div
      class="mt-8 border-t border-slate-200/80 pt-6 dark:border-white/10"
      data-testid="sparkline-presentation"
    >
      <div class="flex flex-wrap items-end justify-between gap-3">
        <span class="text-base font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
          {rangeLabel} trend
        </span>
        {changeStyle ? (
          <span class={`text-3xl font-semibold tabular-nums sm:text-4xl ${changeStyle.colour}`}>
            {directionLabel(change)} {changeStyle.label}
          </span>
        ) : null}
      </div>
      <svg
        class="mt-5 h-40 w-full overflow-visible text-sky-600 sm:h-48 dark:text-sky-300"
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        role="img"
        aria-label={`${label} ${rangeLabel} presentation chart`}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2={SPARKLINE_WIDTH}
          y1={SPARKLINE_HEIGHT - SPARKLINE_PAD}
          y2={SPARKLINE_HEIGHT - SPARKLINE_PAD}
          stroke="currentColor"
          stroke-width="1.5"
          stroke-opacity="0.16"
          vector-effect="non-scaling-stroke"
        />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function directionLabel(change: number | null): string {
  if (change === null || Math.round(change * 10) === 0) return 'Flat';
  return change > 0 ? 'Up' : 'Down';
}
