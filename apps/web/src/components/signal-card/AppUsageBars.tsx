// The minimal daily-series shape the bar chart needs. Both the app-usage and
// Cloudflare-fleet card data satisfy it structurally.
export type DailyBars = {
  readonly windowDays: number;
  readonly days: ReadonlyArray<string>;
  readonly series: ReadonlyArray<number>;
  readonly peakCount: number;
};

// Daily bar chart shared by the expanded hero and the compact summary.
// Fixed viewBox; the SVG scales to the card width via preserveAspectRatio.
const CHART_WIDTH = 240;
const CHART_HEIGHT = 40;
const BAR_GAP = 2;
const MIN_BAR_HEIGHT = 2;

export function AppUsageBars({
  data,
  compact = false,
}: {
  readonly data: DailyBars;
  readonly compact?: boolean;
}) {
  const count = data.series.length;
  const barWidth = (CHART_WIDTH - BAR_GAP * (count - 1)) / count;
  const scale = data.peakCount > 0 ? CHART_HEIGHT / data.peakCount : 0;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      class={compact ? 'h-7 w-full' : 'mt-4 h-11 w-full'}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Daily events over the last ${data.windowDays} days`}
      data-testid="app-usage-bars"
    >
      {data.series.map((value, index) => {
        const height = value > 0 ? Math.max(MIN_BAR_HEIGHT, value * scale) : 0;
        const x = index * (barWidth + BAR_GAP);
        return (
          <g key={data.days[index]}>
            {/* Faint full-height track so quiet days still read as days. */}
            <rect
              x={x}
              y={0}
              width={barWidth}
              height={CHART_HEIGHT}
              rx={1}
              class="fill-slate-200/50 dark:fill-white/[0.06]"
            />
            {height > 0 ? (
              <rect
                x={x}
                y={CHART_HEIGHT - height}
                width={barWidth}
                height={height}
                rx={1}
                class="fill-sky-500/80 dark:fill-violet-400/80"
              >
                <title>{`${data.days[index]}: ${value} events`}</title>
              </rect>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
