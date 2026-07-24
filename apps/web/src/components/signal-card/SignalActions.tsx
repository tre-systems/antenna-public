import type { ApiSignal } from '../../api';
import { startRemoval } from '../../signals/signals';
import { SignalMenu } from '../SignalMenu';
import { StatusPill } from './StatusPill';
import type { CardStatus } from './types';

type Props = {
  readonly cardStatus: CardStatus;
  readonly editableSignal: ApiSignal | null;
  readonly readOnly: boolean;
  readonly compactable: boolean;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
};

export function SignalActions({
  cardStatus,
  editableSignal,
  readOnly,
  compactable,
  expanded,
  onToggleExpanded,
}: Props) {
  return (
    <div class="flex shrink-0 items-center gap-1.5">
      <StatusPill status={cardStatus} />
      {compactable ? (
        <ExpandToggle expanded={expanded} onToggleExpanded={onToggleExpanded} />
      ) : null}
      {readOnly || editableSignal === null ? null : (
        <>
          <SignalMenu signal={editableSignal} />
          <QuickRemove signal={editableSignal} />
        </>
      )}
    </div>
  );
}

function ExpandToggle({
  expanded,
  onToggleExpanded,
}: {
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
}) {
  return (
    <button
      type="button"
      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-900/[0.04] hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/60 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
      aria-label={expanded ? 'Collapse signal details' : 'Expand signal details'}
      aria-expanded={expanded}
      title={expanded ? 'Collapse' : 'Expand'}
      onClick={(event) => {
        event.stopPropagation();
        onToggleExpanded();
      }}
      data-testid="signal-details-toggle"
    >
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        class={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
      >
        <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
      </svg>
    </button>
  );
}

// One-click removal, revealed on card hover. Safe to be this direct because
// startRemoval opens a 5-second undo window before anything is deleted. It
// stays hidden on touch devices (no hover) — the kebab menu covers that path.
function QuickRemove({ signal }: { readonly signal: ApiSignal }) {
  return (
    <button
      type="button"
      aria-label="Remove signal"
      title="Remove signal (you can undo)"
      onClick={() => {
        startRemoval(signal);
      }}
      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition-[opacity,color,background-color] hover:bg-rose-500/10 hover:text-rose-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
      data-testid={`signal-quick-remove-${signal.id}`}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
        <path d="M4.28 4.28a.75.75 0 0 1 1.06 0L8 6.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L9.06 8l2.66 2.66a.75.75 0 1 1-1.06 1.06L8 9.06l-2.66 2.66a.75.75 0 0 1-1.06-1.06L6.94 8 4.28 5.34a.75.75 0 0 1 0-1.06Z" />
      </svg>
    </button>
  );
}
