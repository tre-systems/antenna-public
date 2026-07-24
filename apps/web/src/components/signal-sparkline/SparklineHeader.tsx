import type { ChangeStyle } from './types';
import type { SparklineRange } from './ranges';
import { SPARKLINE_RANGES, sparklineRangeLabel } from './ranges';

type SparklineHeaderProps = {
  readonly label: string;
  readonly range: SparklineRange;
  readonly changeStyle: ChangeStyle | null;
  readonly onRangeChange: (range: SparklineRange) => void;
};

export function SparklineHeader({
  label,
  range,
  changeStyle,
  onRangeChange,
}: SparklineHeaderProps) {
  return (
    <div class="flex items-center justify-between gap-2">
      <span class="min-w-0 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
        {label} · {sparklineRangeLabel(range)}
      </span>
      <div class="flex shrink-0 items-center gap-2">
        {changeStyle !== null ? (
          <span class={`text-xs font-semibold tabular-nums ${changeStyle.colour}`}>
            {changeStyle.label}
          </span>
        ) : null}
        <div
          role="group"
          aria-label={`${label} chart range`}
          class="inline-flex rounded-full bg-slate-100/80 p-0.5 text-[10px] font-semibold dark:bg-white/[0.06]"
        >
          {SPARKLINE_RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={range === option.value}
              onClick={(event) => {
                event.stopPropagation();
                onRangeChange(option.value);
              }}
              class={`rounded-full px-1.5 py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                range === option.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              data-testid={`sparkline-range-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
