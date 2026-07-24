import { PILL_LABELS, PILL_STYLES, PILL_TOOLTIPS } from './status';
import type { CardStatus } from './types';

type Props = {
  readonly status: CardStatus;
};

export function StatusPill({ status }: Props) {
  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${PILL_STYLES[status]}`}
      data-status={status}
      title={PILL_TOOLTIPS[status]}
    >
      {status === 'live' ? <LiveDot /> : null}
      {PILL_LABELS[status]}
    </span>
  );
}

function LiveDot() {
  return (
    <span class="relative flex h-1.5 w-1.5">
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
      <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
    </span>
  );
}
