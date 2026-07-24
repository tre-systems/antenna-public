import type { KarpathyCardData } from '../../signalFormat';

export function KarpathyHero({ data }: { readonly data: KarpathyCardData }) {
  return (
    <div class="mt-5" data-testid="karpathy-hero">
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {data.share}
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">highly AI-exposed</span>
      </div>
      <p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.highJobs}</span> of{' '}
        <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.totalJobs}</span> US
        jobs · weighted{' '}
        <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.weighted}</span> ·{' '}
        <span class="tabular-nums text-slate-700 dark:text-slate-300">{data.occupations}</span>{' '}
        occupations
      </p>
    </div>
  );
}
