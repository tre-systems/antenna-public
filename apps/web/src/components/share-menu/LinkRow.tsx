import { CheckIcon, CopyIcon } from './icons';

export function LinkRow({
  url,
  copied,
  onCopy,
}: {
  readonly url: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
}) {
  return (
    <div class="flex items-center gap-2">
      <span
        class="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
        data-testid="share-url"
        title={url}
      >
        {url}
      </span>
      <button
        type="button"
        onClick={onCopy}
        class={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
          copied
            ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-900/10 hover:bg-white hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/[0.1] dark:hover:text-white'
        }`}
        aria-label={copied ? 'Link copied' : 'Copy collection link'}
        data-testid="share-copy"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span class="sr-only" role="status" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </span>
    </div>
  );
}
