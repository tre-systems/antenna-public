import { compactNumber, type AppUsageCardData } from '../../signalFormat';
import { AppUsageBars } from './AppUsageBars';

export function AppUsageHero({ data }: { readonly data: AppUsageCardData }) {
  const quiet = data.totalEvents === 0;
  return (
    <div class="mt-5" data-testid="app-usage-hero">
      <div class="flex items-baseline justify-between gap-2">
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {compactNumber(data.totalEvents)}
          </span>
          <span class="text-sm text-slate-500 dark:text-slate-400">events</span>
        </div>
        <span class="text-xs text-slate-400 dark:text-slate-500">last {data.windowDays} days</span>
      </div>

      <AppUsageBars data={data} />

      {quiet ? (
        <p class="mt-3 text-xs italic text-slate-400 dark:text-slate-500">
          No events in this window yet.
        </p>
      ) : (
        <TopEvents data={data} />
      )}
    </div>
  );
}

function TopEvents({ data }: { readonly data: AppUsageCardData }) {
  if (data.topEvents.length === 0) return null;
  return (
    <ul class="mt-4 space-y-1.5" data-testid="app-usage-events">
      {data.topEvents.map((entry) => (
        <li key={entry.event} class="flex items-baseline justify-between gap-3 text-sm">
          <span class="min-w-0 truncate text-slate-700 dark:text-slate-300">
            {humanizeEvent(entry.event)}
          </span>
          <span class="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
            {compactNumber(entry.count)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function humanizeEvent(event: string): string {
  return event.replace(/[_-]+/g, ' ').trim();
}
