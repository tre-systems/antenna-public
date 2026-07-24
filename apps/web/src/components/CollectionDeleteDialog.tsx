import { useEffect, useRef, useState } from 'preact/hooks';
import type { CollectionListItem } from '../api';
import { deleteCollection } from '../api';

type Props = {
  readonly collection: CollectionListItem;
  readonly onClose: () => void;
  readonly onDeleted: (id: string) => void;
};

export const canConfirmCollectionDelete = (typed: string, title: string): boolean =>
  typed === title;

export const collectionDeleteErrorMessage = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('last_collection')) return "You can't delete your final collection.";
  if (message.includes('not_found')) return 'Collection was already deleted or is unavailable.';
  return message || 'Could not delete collection.';
};

export function CollectionDeleteDialog({ collection, onClose, onDeleted }: Props) {
  const [typedTitle, setTypedTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmed = canConfirmCollectionDelete(typedTitle, collection.title);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [deleting, onClose]);

  const submit = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteCollection(collection.id);
      onDeleted(res.id);
    } catch (err) {
      setError(collectionDeleteErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      data-testid="delete-collection-dialog"
    >
      <button
        type="button"
        aria-label="Close delete collection"
        onClick={onClose}
        disabled={deleting}
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity disabled:cursor-not-allowed dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-collection-title"
        class="antenna-menu relative m-0 w-full max-w-md rounded-t-2xl p-5 sm:m-4 sm:rounded-2xl"
      >
        <div class="flex items-start justify-between gap-3">
          <h2
            id="delete-collection-title"
            class="text-base font-semibold text-slate-900 dark:text-white"
          >
            Delete collection
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={deleting}
            class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5 dark:hover:text-slate-200"
            data-testid="delete-collection-close"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-4 w-4">
              <path d="M3.7 2.7a1 1 0 0 1 1.4 0L8 5.6l2.9-2.9a1 1 0 1 1 1.4 1.4L9.4 7l2.9 2.9a1 1 0 1 1-1.4 1.4L8 8.4l-2.9 2.9a1 1 0 1 1-1.4-1.4L6.6 7 3.7 4.1a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>

        <div class="mt-5 space-y-4">
          <p class="text-sm text-slate-700 dark:text-slate-200">
            This permanently removes <span class="font-semibold">{collection.title}</span>, its
            signals, saved points, alerts, reports, and notification settings.
          </p>
          <label class="block">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-300">
              Type the collection title to confirm
            </span>
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              type="text"
              value={typedTitle}
              disabled={deleting}
              onInput={(event) => {
                setTypedTitle((event.target as HTMLInputElement).value);
              }}
              class="mt-1 block w-full rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
              data-testid="delete-collection-confirm-title"
            />
          </label>
        </div>

        {error ? (
          <p class="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            class="rounded-md px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={!confirmed || deleting}
            class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:bg-rose-500"
            data-testid="delete-collection-submit"
          >
            {deleting ? 'Deleting…' : 'Delete collection'}
          </button>
        </div>
      </div>
    </div>
  );
}
