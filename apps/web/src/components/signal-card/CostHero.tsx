import type { CostCardData } from '../../signalFormat';

type Props = {
  readonly compact?: boolean;
  readonly data: CostCardData;
};

export function CostHero({ compact = false, data }: Props) {
  return (
    <div class={compact ? 'mt-2' : 'mt-5'}>
      <p class="flex items-baseline gap-2">
        <span
          class={`${compact ? 'text-2xl' : 'text-3xl'} font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white`}
        >
          {data.headline.formattedAmount}
        </span>
        <span class="text-xs font-medium capitalize text-slate-500 dark:text-slate-400">
          {data.headline.periodLabel} · {data.posture.replace('_', ' ')}
        </span>
      </p>
    </div>
  );
}
