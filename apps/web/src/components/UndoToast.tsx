import { useEffect, useState } from 'preact/hooks';
import { signalTitle } from '../signal-format';
import { pendingRemoval, undoRemoval, UNDO_WINDOW_MS } from '../signals/signals';

export function UndoToast() {
  const pending = pendingRemoval.value;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 100);
    return () => {
      clearInterval(id);
    };
  }, [pending]);

  if (!pending) return null;

  const remainingMs = Math.max(0, pending.expiresAt - now);
  const progress = remainingMs / UNDO_WINDOW_MS;

  return (
    <div
      role="status"
      class="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4"
      data-testid="undo-toast"
    >
      <div class="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-slate-900 text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-900/20">
        <div class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <p class="min-w-0 truncate">
            Removed: <span class="font-medium">{signalTitle(pending.signal)}</span>
          </p>
          <button
            type="button"
            onClick={undoRemoval}
            class="shrink-0 rounded-md bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 dark:bg-slate-900/10 dark:hover:bg-slate-900/20"
            data-testid="undo-toast-button"
          >
            Undo
          </button>
        </div>
        {/* Countdown bar shrinks left-to-right over the 5-second window. */}
        <div
          class="h-0.5 bg-emerald-400 dark:bg-emerald-500"
          style={{ width: `${String(Math.round(progress * 100))}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
