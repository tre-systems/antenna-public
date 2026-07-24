import { useRef } from 'preact/hooks';
import { type ApiSignal } from '../../api';
import { displayedSignals, fetchError, loadSignals } from '../../signals/signals';
import { SignalGridItem } from '../SignalGridItem';
import { useGridFlip } from './flip';

export function SignalGrid() {
  const current = displayedSignals.value;
  const error = fetchError.value;

  if (error && current === null) return <LoadError error={error} />;
  if (current === null) return <LoadingGrid />;
  if (current.length === 0) return <EmptyGrid />;
  return <FlatSignalGrid signals={current} />;
}

function LoadError({ error }: { readonly error: string }) {
  return (
    <div class="rounded-2xl bg-white/70 backdrop-blur-xl p-6 ring-1 ring-rose-300/40 text-sm dark:bg-white/[0.04] dark:ring-rose-400/20">
      <p class="font-medium text-rose-700 dark:text-rose-300">Couldn't load signals.</p>
      <p class="mt-1 text-slate-500 dark:text-slate-400">{error}</p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 dark:from-violet-500 dark:to-indigo-600"
        onClick={() => {
          void loadSignals();
        }}
      >
        Retry
      </button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          class="rounded-2xl bg-white/70 p-5 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.6)]"
          aria-hidden="true"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 space-y-2">
              <div class="h-4 w-2/3 animate-pulse rounded bg-slate-200/70 dark:bg-white/10" />
              <div class="h-3 w-1/3 animate-pulse rounded bg-slate-200/60 dark:bg-white/[0.06]" />
            </div>
            <div class="h-5 w-12 animate-pulse rounded-full bg-slate-200/70 dark:bg-white/10" />
          </div>
          <div class="mt-5 h-9 w-2/5 animate-pulse rounded-md bg-slate-200/70 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function EmptyGrid() {
  return (
    <div class="rounded-2xl bg-white/70 backdrop-blur-xl p-6 ring-1 ring-slate-900/5 text-sm text-slate-500 dark:bg-white/[0.04] dark:ring-white/10 dark:text-slate-400">
      No signals yet — use Add signal in the toolbar to create your first one.
    </div>
  );
}

// One flat grid in the user's stored order — no fixed sections, so any card
// can be dragged to any slot (favourites up top). The FLIP hook slides cards
// into place whenever the order changes: live drag previews, removals, and
// expand/collapse reflows all animate instead of snapping.
function FlatSignalGrid({ signals }: { readonly signals: ApiSignal[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  useGridFlip(gridRef);
  return (
    <div ref={gridRef} class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {signals.map((signal) => (
        <div key={signal.id} class="signal-grid-cell group" data-signal-id={signal.id}>
          <SignalGridItem signal={signal} />
        </div>
      ))}
    </div>
  );
}
