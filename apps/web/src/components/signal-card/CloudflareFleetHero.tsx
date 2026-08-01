import { compactNumber, type CloudflareFleetCardData, type FleetWorker } from '../../signal-format';
import { AppUsageBars } from './AppUsageBars';

export function CloudflareFleetHero({ data }: { readonly data: CloudflareFleetCardData }) {
  const quiet = data.totalRequests === 0;
  return (
    <div class="mt-5" data-testid="cloudflare-fleet-hero">
      <div class="flex items-baseline justify-between gap-2">
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {compactNumber(data.totalRequests)}
          </span>
          <span class="text-sm text-slate-500 dark:text-slate-400">requests</span>
        </div>
        <span class="text-xs text-slate-400 dark:text-slate-500">last {data.windowDays} days</span>
      </div>

      <AppUsageBars data={data} />

      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Worker invocations include APIs, bots and automation—not human visits.
      </p>

      {data.previousWindowRequests !== null ? (
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {compactNumber(data.currentWindowRequests)} in complete 24h ·{' '}
          {data.requestChangePercent === null
            ? 'no baseline'
            : `${data.requestChangePercent > 0 ? '+' : ''}${Math.round(data.requestChangePercent)}%`}{' '}
          vs previous · {compactNumber(data.currentWindowErrors)} errors (
          {(data.currentErrorRatePpm / 10_000).toFixed(2)}%)
        </p>
      ) : null}

      {quiet ? (
        <p class="mt-3 text-xs italic text-slate-400 dark:text-slate-500">No traffic yet.</p>
      ) : (
        <WorkerList data={data} />
      )}
    </div>
  );
}

function WorkerList({ data }: { readonly data: CloudflareFleetCardData }) {
  if (data.workers.length === 0) return null;
  return (
    <div class="mt-4" data-testid="cloudflare-fleet-workers">
      <p class="mb-2 flex items-baseline justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span>{data.workerCount} workers</span>
        {data.totalErrors > 0 ? (
          <span class="text-rose-600 dark:text-rose-300">
            {compactNumber(data.totalErrors)} errors
          </span>
        ) : null}
      </p>
      <ul class="space-y-1.5">
        {data.workers.map((worker) => (
          <WorkerRow key={worker.script} worker={worker} />
        ))}
      </ul>
    </div>
  );
}

function WorkerRow({ worker }: { readonly worker: FleetWorker }) {
  return (
    <li class="flex items-baseline justify-between gap-3 text-sm">
      <span class="min-w-0 truncate text-slate-700 dark:text-slate-300">{worker.script}</span>
      <span class="flex shrink-0 items-baseline gap-1.5">
        {worker.errors > 0 ? (
          <span class="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300">
            {compactNumber(worker.errors)} err
          </span>
        ) : null}
        <span class="tabular-nums text-slate-500 dark:text-slate-400">
          {compactNumber(worker.requests)}
        </span>
      </span>
    </li>
  );
}
