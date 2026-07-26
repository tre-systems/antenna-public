import { useMemo } from 'preact/hooks';
import { changeColour, percentChange } from './labels';
import { sparklinePath, sortSeries } from './geometry';
import { DEFAULT_SPARKLINE_RANGE, filterSeriesForRange, sparklineRangeLabel } from './ranges';
import type { SeriesPoint } from './types';
import { SPARKLINE_HEIGHT, SPARKLINE_PAD, SPARKLINE_WIDTH } from './types';

type SparklineSummaryFigureProps = {
  readonly label: string;
  readonly points: readonly SeriesPoint[];
};

export function SparklineSummaryFigure({ label, points }: SparklineSummaryFigureProps) {
  const fullSeries = useMemo(() => sortSeries(points), [points]);
  const visibleSeries = useMemo(
    () => filterSeriesForRange(fullSeries, DEFAULT_SPARKLINE_RANGE),
    [fullSeries],
  );
  const path = useMemo(() => sparklinePath(visibleSeries), [visibleSeries]);
  const changeStyle = changeColour(percentChange(visibleSeries));
  const rangeLabel = sparklineRangeLabel(DEFAULT_SPARKLINE_RANGE);

  return (
    <div class="ml-auto flex min-w-[8.5rem] max-w-[11rem] flex-1 items-center justify-end gap-2">
      <svg
        class="h-10 min-w-0 flex-1 overflow-visible text-emerald-600 dark:text-emerald-300"
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        role="img"
        aria-label={`${label} ${rangeLabel} mini chart`}
        preserveAspectRatio="none"
        data-testid="sparkline-summary"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <line
          x1="0"
          x2={SPARKLINE_WIDTH}
          y1={SPARKLINE_HEIGHT - SPARKLINE_PAD}
          y2={SPARKLINE_HEIGHT - SPARKLINE_PAD}
          stroke="currentColor"
          stroke-width="1"
          stroke-opacity="0.12"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      {changeStyle ? (
        <span
          class={`min-w-12 text-right text-xs font-semibold tabular-nums ${changeStyle.colour}`}
        >
          {changeStyle.label}
        </span>
      ) : null}
    </div>
  );
}
