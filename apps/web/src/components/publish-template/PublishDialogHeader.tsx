type Props = {
  readonly saving: boolean;
  readonly onClose: () => void;
};

export function PublishDialogHeader({ saving, onClose }: Props) {
  return (
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2
          id="publish-template-title"
          class="text-base font-semibold text-slate-900 dark:text-white"
        >
          Publish as template
        </h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Shareable signals become reusable. Private or blocked signals are skipped.
        </p>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        disabled={saving}
        class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:hover:bg-white/5 dark:hover:text-slate-200"
        data-testid="publish-template-close"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-4 w-4">
          <path d="M3.7 2.7a1 1 0 0 1 1.4 0L8 5.6l2.9-2.9a1 1 0 1 1 1.4 1.4L9.4 7l2.9 2.9a1 1 0 1 1-1.4 1.4L8 8.4l-2.9 2.9a1 1 0 1 1-1.4-1.4L6.6 7 3.7 4.1a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
    </div>
  );
}
