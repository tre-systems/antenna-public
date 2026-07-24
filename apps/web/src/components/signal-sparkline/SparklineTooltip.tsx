import { formatValue } from '../../signalFormat';
import { formatHoverDate } from './labels';
import type { SeriesPoint } from './types';

type SparklineTooltipProps = {
  readonly point: SeriesPoint | null;
  readonly left: string;
};

export function SparklineTooltip({ point, left }: SparklineTooltipProps) {
  if (point === null) return null;

  return (
    <div
      class="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-sm dark:bg-white dark:text-slate-900"
      style={`left: ${left}`}
      data-testid="sparkline-tooltip"
    >
      <span class="font-medium tabular-nums">{formatValue(point.value)}</span>
      <span class="ml-2 text-slate-300 dark:text-slate-500">{formatHoverDate(point.ts)}</span>
    </div>
  );
}
