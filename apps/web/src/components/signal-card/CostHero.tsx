import type { CostCardData } from '../../signal-format';

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
          {data.headline.label} · {data.headline.periodLabel}
        </span>
      </p>
      {data.breakdown.length > 0 ? (
        <dl class="mt-3 space-y-2 border-t border-slate-200/70 pt-3 text-xs dark:border-white/10">
          {data.breakdown.map((item) => (
            <div key={item.label}>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-slate-500 dark:text-slate-400">{item.label}</dt>
                <dd class="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                  {item.formattedAmount}
                </dd>
              </div>
              <p class="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{item.note}</p>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
