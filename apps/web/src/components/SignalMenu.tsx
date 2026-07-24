import { useEffect, useRef, useState } from 'preact/hooks';
import type { ApiSignal } from '../api';
import { settingsSignalId, startRemoval } from '../signals/signals';

type Props = { readonly signal: ApiSignal };

// Signal-corner kebab menu. Today it only carries Remove; the slot is set up
// for future actions (Edit, Refresh, Duplicate) without rewiring the signal
// chrome each time.
export function SignalMenu({ signal }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleRemove = () => {
    setOpen(false);
    startRemoval(signal);
  };

  const handleSettings = () => {
    setOpen(false);
    settingsSignalId.value = signal.id;
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
      }}
      class="relative"
    >
      <button
        type="button"
        aria-label="Signal actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-200"
        data-testid={`signal-menu-${signal.id}`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-4 w-4">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          class="absolute right-0 top-8 z-10 min-w-[10rem] overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleSettings}
            class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-900/[0.04] dark:text-slate-200 dark:hover:bg-white/5"
            data-testid={`signal-settings-${signal.id}`}
          >
            Settings…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleRemove}
            class="block w-full px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
            data-testid={`signal-remove-${signal.id}`}
          >
            Remove signal
          </button>
        </div>
      ) : null}
    </div>
  );
}
