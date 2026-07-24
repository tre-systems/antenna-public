export const templateButtonClass = (selected: boolean): string =>
  [
    'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60',
    selected
      ? 'border-sky-300 bg-sky-50/80 dark:border-sky-400/40 dark:bg-sky-400/10'
      : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
  ].join(' ');

export const templatePillClass = (selected: boolean): string =>
  selected
    ? 'shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[0.65rem] font-medium text-white dark:bg-sky-400 dark:text-slate-950'
    : 'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300';
