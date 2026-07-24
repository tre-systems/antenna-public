import type { ApiSignal, CollectionRecord } from '@antenna/shared';
import { signals as signalsState } from '../signals/signals';

type Props = {
  readonly visibility: CollectionRecord['visibility'];
};

type HiddenReason = { readonly kind: 'policy' } | { readonly kind: 'not-shared' };

export function ShareDisplayMatrix({ visibility }: Props) {
  const signals = signalsState.value;
  if (visibility !== 'shared' || !signals || signals.length === 0) return null;

  const hiddenReasons = signals.map(classify).filter((reason): reason is HiddenReason => !!reason);
  const blockedByPolicy = hiddenReasons.filter((reason) => reason.kind === 'policy').length;
  const privateSignals = hiddenReasons.filter((reason) => reason.kind === 'not-shared').length;
  const visibleCount = signals.length - hiddenReasons.length;

  return (
    <div
      class="rounded-md bg-slate-100/80 px-3 py-2 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
      data-testid="share-display-matrix"
    >
      <p>
        <span class="font-medium">
          {visibleCount} of {signals.length}
        </span>{' '}
        signal{signals.length === 1 ? '' : 's'} visible on this link
        {hiddenReasons.length === 0 ? '.' : ` · ${String(hiddenReasons.length)} hidden`}
      </p>
      {hiddenReasons.length > 0 ? (
        <HiddenSummary blockedByPolicy={blockedByPolicy} privateSignals={privateSignals} />
      ) : null}
    </div>
  );
}

function HiddenSummary({
  blockedByPolicy,
  privateSignals,
}: {
  readonly blockedByPolicy: number;
  readonly privateSignals: number;
}) {
  return (
    <ul
      class="mt-2 space-y-1 border-t border-slate-300/60 pt-2 dark:border-white/10"
      data-testid="share-display-hidden-summary"
    >
      {blockedByPolicy > 0 ? (
        <HiddenReason count={blockedByPolicy} label="blocked by source policy" tone="policy" />
      ) : null}
      {privateSignals > 0 ? (
        <HiddenReason count={privateSignals} label="not marked shared" tone="private" />
      ) : null}
    </ul>
  );
}

function HiddenReason({
  count,
  label,
  tone,
}: {
  readonly count: number;
  readonly label: string;
  readonly tone: 'policy' | 'private';
}) {
  return (
    <li class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
      <span
        aria-hidden="true"
        class={`h-2 w-2 rounded-full ${tone === 'policy' ? 'bg-amber-500' : 'bg-slate-400'}`}
      />
      <span>
        {count} {label}
      </span>
    </li>
  );
}

function classify(signal: ApiSignal): HiddenReason | null {
  const blocker = signal.source_policy?.public_display_blocker ?? null;
  if (blocker !== null) {
    return { kind: 'policy' };
  }
  if (signal.visibility !== 'shared' && signal.visibility !== 'public') {
    return { kind: 'not-shared' };
  }
  return null;
}
