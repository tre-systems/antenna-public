import { dismissNotice, notice } from '../signals/signals';

// Shares UndoToast's position because the shell renders only one notice at a time.
export function NoticeToast() {
  const message = notice.value;
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4"
      data-testid="notice-toast"
    >
      <div class="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-900/20">
        <span class="shrink-0 text-emerald-400 dark:text-emerald-500" aria-hidden="true">
          <CheckIcon />
        </span>
        <span class="min-w-0">{message}</span>
        <button
          type="button"
          onClick={dismissNotice}
          class="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 dark:text-slate-900/50 dark:hover:bg-slate-900/10 dark:hover:text-slate-900"
          data-testid="notice-toast-dismiss"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-4 w-4">
    <path
      fillRule="evenodd"
      d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0L3.22 8.28a.75.75 0 0 1 1.06-1.06L7 9.94l5.72-5.72a.75.75 0 0 1 1.06 0Z"
      clipRule="evenodd"
    />
  </svg>
);
