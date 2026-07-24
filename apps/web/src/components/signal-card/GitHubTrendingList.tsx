import type { GithubTrendingRow } from '../../signalFormat';

export function GitHubTrendingList({ rows }: { readonly rows: ReadonlyArray<GithubTrendingRow> }) {
  return (
    <ul class="mt-5 space-y-3" data-testid="github-trending-list">
      {rows.map((row, idx) => (
        <li key={`${row.repo}-${String(idx)}`} class="flex items-baseline gap-2.5">
          <span class="w-5 shrink-0 text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
            #{row.rank || idx + 1}
          </span>
          <div class="min-w-0 flex-1">
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                class="block truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/60 dark:text-slate-100"
              >
                {row.repo}
              </a>
            ) : (
              <span class="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {row.repo}
              </span>
            )}
            {row.language || row.starsToday ? <TrendingMeta row={row} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TrendingMeta({ row }: { readonly row: GithubTrendingRow }) {
  return (
    <p class="mt-0.5 flex items-baseline gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      {row.language ? <span>{row.language}</span> : null}
      {row.language && row.starsToday ? (
        <span class="text-slate-300 dark:text-slate-600">·</span>
      ) : null}
      {row.starsToday ? (
        <span class="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
          +{row.starsToday}
        </span>
      ) : null}
      {row.starsToday ? <span class="text-slate-400 dark:text-slate-500">stars today</span> : null}
    </p>
  );
}
