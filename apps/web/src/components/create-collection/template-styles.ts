export const templateButtonClass = (selected: boolean): string =>
  [
    'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60',
    selected
      ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-400/40 dark:bg-emerald-400/10'
      : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
  ].join(' ');

export const templatePillClass = (selected: boolean): string =>
  selected
    ? 'shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-[0.65rem] font-medium text-white dark:bg-emerald-300 dark:text-emerald-950'
    : 'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300';
