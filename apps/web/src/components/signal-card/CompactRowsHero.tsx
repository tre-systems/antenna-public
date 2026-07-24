import type { CompactRow, CompactRowsCardData } from '../../signalFormat';

const CHIP_TONES: Record<CompactRow['chipTone'], string> = {
  urgent: 'bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300',
  warn: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300',
  ok: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300',
  muted: 'bg-slate-500/10 text-slate-500 ring-slate-500/15 dark:text-slate-400',
};

export function CompactRowsHero({ data }: { readonly data: CompactRowsCardData }) {
  if (data.rows.length === 0) {
    return (
      <p
        class="mt-5 text-sm italic text-slate-500 dark:text-slate-400"
        data-testid="compact-rows-empty"
      >
        Nothing to report right now.
      </p>
    );
  }
  return (
    <div class="mt-5" data-testid="compact-rows-hero">
      {data.summary ? (
        <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {data.summary}
        </p>
      ) : null}
      <ul class="space-y-2.5">
        {data.rows.map((row) => (
          <CompactRowItem key={row.rank} row={row} />
        ))}
      </ul>
    </div>
  );
}

function CompactRowItem({ row }: { readonly row: CompactRow }) {
  const body = <CompactRowBody row={row} />;
  return (
    <li>
      {row.href ? (
        <a
          href={row.href}
          target="_blank"
          rel="noreferrer"
          class="-mx-1 block rounded-md px-1 py-0.5 transition-colors hover:bg-slate-900/[0.03] focus:outline-none focus:ring-2 focus:ring-sky-400/60 dark:hover:bg-white/5"
        >
          {body}
        </a>
      ) : (
        <div class="-mx-1 px-1 py-0.5">{body}</div>
      )}
    </li>
  );
}

function CompactRowBody({ row }: { readonly row: CompactRow }) {
  return (
    <div class="flex min-w-0 items-start gap-2">
      <span class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200/70 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
        {row.rank}
      </span>
      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-sm leading-snug text-slate-900 dark:text-slate-100">
          {row.title}
        </p>
        {row.subtitle ? (
          <p class="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {row.subtitle}
          </p>
        ) : null}
      </div>
      {row.chip ? <CompactRowChip row={row} /> : null}
    </div>
  );
}

function CompactRowChip({ row }: { readonly row: CompactRow }) {
  return (
    <span
      class={`shrink-0 self-start rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums uppercase ring-1 ring-inset ${CHIP_TONES[row.chipTone]}`}
    >
      {row.chip}
    </span>
  );
}
