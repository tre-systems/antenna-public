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
    <div class="antenna-panel rounded-2xl p-6 text-sm ring-1 ring-rose-300/40 dark:ring-rose-400/20">
      <p class="font-medium text-rose-700 dark:text-rose-300">Couldn't load signals.</p>
      <p class="mt-1 text-slate-500 dark:text-slate-400">{error}</p>
      <button
        type="button"
        class="antenna-primary mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
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
        <div key={i} class="antenna-panel rounded-2xl p-5" aria-hidden="true">
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
    <div class="antenna-panel rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-400">
      No signals yet — ask your connected agent to add one.
    </div>
  );
}

// Keep one flat grid so every card can move to every slot.
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
