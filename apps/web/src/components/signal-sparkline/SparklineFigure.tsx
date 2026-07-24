import { useMemo, useState } from 'preact/hooks';
import { changeColour, percentChange } from './labels';
import { sparklinePath, sortSeries } from './geometry';
import { DEFAULT_SPARKLINE_RANGE, filterSeriesForRange, sparklineRangeLabel } from './ranges';
import { SparklineHeader } from './SparklineHeader';
import { SparklineSvg } from './SparklineSvg';
import { SparklineTooltip } from './SparklineTooltip';
import type { SeriesPoint } from './types';
import { useSparklineHover } from './use-sparkline-hover';

type SparklineFigureProps = {
  readonly label: string;
  readonly points: readonly SeriesPoint[];
  readonly compact?: boolean;
};

export function SparklineFigure({ label, points, compact = false }: SparklineFigureProps) {
  const [range, setRange] = useState(DEFAULT_SPARKLINE_RANGE);
  const fullSeries = useMemo(() => sortSeries(points), [points]);
  const visibleSeries = useMemo(() => filterSeriesForRange(fullSeries, range), [fullSeries, range]);
  const path = useMemo(() => sparklinePath(visibleSeries), [visibleSeries]);
  const hover = useSparklineHover(visibleSeries);
  const rangeLabel = sparklineRangeLabel(range);
  const changeStyle = changeColour(percentChange(visibleSeries));

  return (
    <div
      class={`${compact ? 'mt-3 pt-2' : 'mt-4 pt-3'} border-t border-slate-200/70 dark:border-white/10`}
    >
      <SparklineHeader
        label={label}
        range={range}
        changeStyle={changeStyle}
        onRangeChange={setRange}
      />
      <div class="relative mt-2">
        <SparklineSvg
          label={label}
          spanLabel={rangeLabel}
          path={path}
          hover={hover}
          compact={compact}
        />
        <SparklineTooltip point={hover.point} left={hover.tooltipLeft} />
      </div>
    </div>
  );
}
