import { useEffect, useState } from 'preact/hooks';
import type { ReportCollectionCategory } from '../api';
import { reportPublicCollection } from '../api';

type Props = {
  readonly slug: string;
  readonly onClose: () => void;
};

type SubmitState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent' }
  | { readonly kind: 'error'; readonly message: string };

const CATEGORIES: ReadonlyArray<{
  readonly value: ReportCollectionCategory;
  readonly label: string;
  readonly hint: string;
}> = [
  { value: 'broken', label: 'Broken', hint: 'Signals stuck, errors, no data, layout broken.' },
  {
    value: 'inappropriate',
    label: 'Inappropriate',
    hint: 'Hateful, unsafe, or misleading content.',
  },
  { value: 'spam', label: 'Spam', hint: 'Promotional, low-effort, or duplicate content.' },
  { value: 'other', label: 'Other', hint: 'Something else worth flagging.' },
];

// Small anonymous report dialog for /c/:slug visitors.  No auth — the Worker
// hashes IP + UA at write time and keeps the message body small.
export function ReportCollectionDialog({ slug, onClose }: Props) {
  const [category, setCategory] = useState<ReportCollectionCategory>('broken');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const submit = async () => {
    setState({ kind: 'sending' });
    try {
      await reportPublicCollection(slug, {
        category,
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setState({ kind: 'sent' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not submit the report.',
      });
    }
  };

  return (
    <div
      class="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      data-testid="report-collection-dialog"
    >
      <button
        type="button"
        aria-label="Close report"
        onClick={onClose}
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-collection-title"
        class="relative m-0 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl ring-1 ring-slate-900/10 sm:m-4 sm:rounded-2xl dark:bg-slate-900 dark:ring-white/10"
      >
        <div class="flex items-start justify-between gap-3">
          <h2
            id="report-collection-title"
            class="text-base font-semibold text-slate-900 dark:text-white"
          >
            Report this collection
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:hover:bg-white/5 dark:hover:text-slate-200"
            data-testid="report-collection-close"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-4 w-4">
              <path d="M3.7 2.7a1 1 0 0 1 1.4 0L8 5.6l2.9-2.9a1 1 0 1 1 1.4 1.4L9.4 7l2.9 2.9a1 1 0 1 1-1.4 1.4L8 8.4l-2.9 2.9a1 1 0 1 1-1.4-1.4L6.6 7 3.7 4.1a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>

        {state.kind === 'sent' ? (
          <div class="mt-5 space-y-2" data-testid="report-collection-sent">
            <p class="text-sm text-slate-700 dark:text-slate-200">Thanks — report received.</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              We'll review reported collections and act when needed.
            </p>
            <div class="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:bg-white dark:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <fieldset class="mt-5">
              <legend class="text-xs font-medium text-slate-600 dark:text-slate-300">Reason</legend>
              <div class="mt-1 flex flex-col gap-1.5">
                {CATEGORIES.map((opt) => (
                  <label key={opt.value} class="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="report-category"
                      value={opt.value}
                      checked={category === opt.value}
                      disabled={state.kind === 'sending'}
                      onChange={() => {
                        setCategory(opt.value);
                      }}
                      class="mt-0.5"
                      data-testid={`report-category-${opt.value}`}
                    />
                    <span class="min-w-0">
                      <span class="font-medium text-slate-700 dark:text-slate-200">
                        {opt.label}
                      </span>
                      <span class="ml-1 text-xs text-slate-500 dark:text-slate-400">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label class="mt-4 block">
              <span class="text-xs font-medium text-slate-600 dark:text-slate-300">
                Anything else? (optional)
              </span>
              <textarea
                value={message}
                maxLength={1000}
                disabled={state.kind === 'sending'}
                rows={3}
                onInput={(event) => {
                  setMessage((event.target as HTMLTextAreaElement).value);
                }}
                class="mt-1 block w-full resize-none rounded-md border border-slate-300 bg-white/90 px-2 py-1 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200"
                data-testid="report-collection-message"
              />
            </label>

            {state.kind === 'error' ? (
              <p class="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
                {state.message}
              </p>
            ) : null}

            <div class="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={state.kind === 'sending'}
                class="rounded-md px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void submit();
                }}
                disabled={state.kind === 'sending'}
                class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:bg-white dark:text-slate-900"
                data-testid="report-collection-submit"
              >
                {state.kind === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
