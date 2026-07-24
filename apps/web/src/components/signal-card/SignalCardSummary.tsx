import type { ApiSignal, DataPoint } from '../../api';
import {
  appUsageCardData,
  cloudflareFleetCardData,
  compactNumber,
  compactRowsCardData,
  costCardData,
  githubTrendingCardData,
  pointValueText,
  type AppUsageCardData,
  type CloudflareFleetCardData,
  type CompactRow,
  type GithubTrendingRow,
} from '../../signalFormat';
import { SignalSparkline } from '../SignalSparkline';
import { AppUsageBars } from './AppUsageBars';
import { CostHero } from './CostHero';
import type { CardStatus, RenderSignal } from './types';

type Props = {
  readonly signal: RenderSignal;
  readonly cardStatus: CardStatus;
  readonly points: ReadonlyArray<DataPoint>;
  readonly editableSignal: ApiSignal | null;
};

export function SignalCardSummary({ signal, cardStatus, points, editableSignal }: Props) {
  const cost = costCardData(signal);
  if (cost) return <CostHero data={cost} compact />;

  const appUsage = appUsageCardData(signal);
  if (appUsage) return <AppUsageSummary data={appUsage} />;

  const fleet = cloudflareFleetCardData(signal);
  if (fleet) return <FleetSummary data={fleet} />;

  const trendingRows = githubTrendingCardData(signal);
  if (trendingRows && trendingRows.length > 0) {
    return <TrendingSummary rows={trendingRows.slice(0, 2)} />;
  }
  const rowData = compactRowsCardData(signal);
  if (rowData && rowData.rows.length > 0) {
    return <RowsSummary summary={rowData.summary} rows={rowData.rows.slice(0, 2)} />;
  }
  if (points.length === 0) return <EmptySummary cardStatus={cardStatus} />;
  return <PointSummary point={points[0]} editableSignal={editableSignal} />;
}

function AppUsageSummary({ data }: { readonly data: AppUsageCardData }) {
  return (
    <div class="mt-2" data-testid="app-usage-summary">
      <p class="flex items-baseline gap-1.5">
        <span class="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {compactNumber(data.totalEvents)}
        </span>
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
          events · {data.windowDays}d
        </span>
      </p>
      <div class="mt-2">
        <AppUsageBars data={data} compact />
      </div>
    </div>
  );
}

function FleetSummary({ data }: { readonly data: CloudflareFleetCardData }) {
  return (
    <div class="mt-2" data-testid="cloudflare-fleet-summary">
      <p class="flex items-baseline gap-1.5">
        <span class="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {compactNumber(data.totalRequests)}
        </span>
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
          requests · {data.windowDays}d
        </span>
        {data.totalErrors > 0 ? (
          <span class="text-xs font-medium text-rose-600 dark:text-rose-300">
            · {compactNumber(data.totalErrors)} err
          </span>
        ) : null}
      </p>
      <div class="mt-2">
        <AppUsageBars data={data} compact />
      </div>
    </div>
  );
}

function TrendingSummary({ rows }: { readonly rows: ReadonlyArray<GithubTrendingRow> }) {
  return (
    <ul class="mt-3 space-y-2" data-testid="github-trending-summary">
      {rows.map((row, idx) => (
        <li key={`${row.repo}-${String(idx)}`} class="flex min-w-0 items-center gap-2">
          <span class="w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
            #{row.rank || idx + 1}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {row.repo}
          </span>
          {row.starsToday ? (
            <span class="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              +{row.starsToday}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PointSummary({
  point,
  editableSignal,
}: {
  readonly point: DataPoint | undefined;
  readonly editableSignal: ApiSignal | null;
}) {
  if (!point) return null;
  return (
    <div class="mt-2 flex items-end gap-3">
      <div class="min-w-0 flex-1">
        <p class="flex min-w-0 items-baseline gap-1.5">
          <span class="min-w-0 truncate text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {pointValueText(point)}
          </span>
          {point.unit ? (
            <span class="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
              {point.unit}
            </span>
          ) : null}
        </p>
      </div>
      {editableSignal ? <SignalSparkline signal={editableSignal} variant="summary" /> : null}
    </div>
  );
}

function RowsSummary({
  summary,
  rows,
}: {
  readonly summary: string | null;
  readonly rows: ReadonlyArray<CompactRow>;
}) {
  return (
    <div class="mt-2">
      {summary ? (
        <p class="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {summary}
        </p>
      ) : null}
      <ul class="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.rank} class="flex min-w-0 items-center justify-between gap-2">
            <span class="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {row.title}
            </span>
            {row.chip ? (
              <span class="shrink-0 rounded-full bg-slate-900/[0.04] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-900/10 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
                {row.chip}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptySummary({ cardStatus }: { readonly cardStatus: CardStatus }) {
  const copy = emptySummaryCopy(cardStatus);
  return (
    <p class="mt-3 rounded-lg bg-slate-900/[0.03] px-3 py-2 text-sm font-medium text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
      {copy}
    </p>
  );
}

function emptySummaryCopy(cardStatus: CardStatus): string {
  if (cardStatus === 'setup') return 'Needs setup before data can refresh.';
  if (cardStatus === 'error') return 'Last refresh failed.';
  if (cardStatus === 'loading') return 'Waiting for the first update.';
  if (cardStatus === 'stale') return 'Waiting for a fresh update.';
  return 'Waiting for the next tick.';
}
