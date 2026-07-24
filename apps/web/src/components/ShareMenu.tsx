import { useEffect, useRef, useState } from 'preact/hooks';
import type { CollectionRecord } from '@antenna/shared';
import { ShareDisplayMatrix } from './ShareDisplayMatrix';

type Visibility = CollectionRecord['visibility'];

type Props = {
  readonly visibility: Visibility;
  readonly slug: string | null;
  readonly onChange: (next: Visibility) => Promise<void>;
};

type OptionDef = {
  readonly value: Exclude<Visibility, 'public'>;
  readonly label: string;
  readonly hint: string;
  readonly icon: () => preact.ComponentChildren;
};

const OPTIONS: readonly OptionDef[] = [
  {
    value: 'private',
    label: 'Private',
    hint: 'Only you can see this collection.',
    icon: LockIcon,
  },
  {
    value: 'shared',
    label: 'Shared',
    hint: 'Anyone with the link can view approved shared signals.',
    icon: LinkIcon,
  },
];

// Sharing is a secondary, policy-gated action in a private-first product, so it
// lives behind this single toolbar button rather than an always-on toggle. The
// popover holds the visibility choice, the read-only link, and the matrix that
// explains which signals are exposed.
export function ShareMenu({ visibility, slug, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Visibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Outside-click and Escape close the popover. Same pattern as ProfileMenu.
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

  const isShared = visibility !== 'private';
  const shareUrl = isShared && slug ? `${origin()}/c/${slug}` : null;

  const handleSelect = async (next: Visibility): Promise<void> => {
    if (next === visibility || pending) return;
    setPending(next);
    setError(null);
    try {
      await onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change visibility.');
    } finally {
      setPending(null);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!shareUrl) return;
    setError(null);
    try {
      await copyText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setError('Clipboard unavailable.');
    }
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
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        class="inline-flex items-center justify-center gap-0 rounded-lg bg-white/50 px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-900/10 transition hover:bg-white/80 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/40 min-[780px]:gap-1 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white"
        data-testid="share-open"
        aria-label="Share collection"
        title="Share this collection"
      >
        <LinkIcon />
        <span class="hidden min-[780px]:inline">Share</span>
        {isShared ? (
          <span
            aria-hidden="true"
            class="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
            title="A read-only link is live"
          />
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Share collection"
          class="absolute right-0 top-11 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-white p-3 text-left shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10"
          data-testid="share-menu"
        >
          <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Visibility
          </p>
          <div role="group" aria-label="Collection visibility" class="space-y-1">
            {OPTIONS.map((opt) => (
              <VisibilityOption
                key={opt.value}
                opt={opt}
                active={opt.value === visibility}
                busy={pending === opt.value}
                disabled={pending !== null}
                onSelect={() => {
                  void handleSelect(opt.value);
                }}
              />
            ))}
          </div>
          <div class="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
            {isShared ? (
              <>
                {shareUrl ? (
                  <LinkRow
                    url={shareUrl}
                    copied={copied}
                    onCopy={() => {
                      void handleCopy();
                    }}
                  />
                ) : null}
                <div class="mt-2">
                  <ShareDisplayMatrix visibility={visibility} />
                </div>
              </>
            ) : (
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Switch to Shared to create a read-only link. Only approved shared signals appear.
              </p>
            )}
          </div>
          {error ? (
            <p
              class="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function VisibilityOption({
  opt,
  active,
  busy,
  disabled,
  onSelect,
}: {
  readonly opt: OptionDef;
  readonly active: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onSelect}
      class={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 ${
        active
          ? 'bg-slate-100 dark:bg-white/[0.08]'
          : 'hover:bg-slate-900/[0.04] dark:hover:bg-white/5'
      }`}
      data-testid={`visibility-${opt.value}`}
    >
      <span class="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">{opt.icon()}</span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
          {opt.label}
          {busy ? <span class="text-xs font-normal text-slate-400">Saving…</span> : null}
        </span>
        <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
      </span>
      {active ? (
        <span class="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400">
          <CheckIcon />
        </span>
      ) : null}
    </button>
  );
}

function LinkRow({
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
        class={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-sky-400/40 ${
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

const origin = (): string => (typeof window === 'undefined' ? '' : window.location.origin);

async function copyText(text: string): Promise<void> {
  if (typeof navigator === 'undefined') throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
      <path d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1 0h4V5a2 2 0 1 0-4 0v2Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
      <path d="M7.05 9.293 8.464 7.88a3 3 0 0 1 4.243 4.242l-2.122 2.122a3 3 0 0 1-4.242 0 .75.75 0 1 1 1.06-1.061 1.5 1.5 0 0 0 2.122 0l2.121-2.122a1.5 1.5 0 0 0-2.121-2.121l-1.414 1.414a.75.75 0 0 1-1.061-1.06ZM8.95 6.707 7.536 8.121a3 3 0 0 1-4.243-4.242l2.122-2.122a3 3 0 0 1 4.242 0 .75.75 0 1 1-1.06 1.061 1.5 1.5 0 0 0-2.122 0L4.354 4.94a1.5 1.5 0 0 0 2.121 2.121l1.414-1.414a.75.75 0 0 1 1.061 1.06Z" />
    </svg>
  );
}

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
    <path d="M5.5 2A1.5 1.5 0 0 0 4 3.5V4H3.5A1.5 1.5 0 0 0 2 5.5v7A1.5 1.5 0 0 0 3.5 14h7a1.5 1.5 0 0 0 1.5-1.5V12h.5A1.5 1.5 0 0 0 14 10.5v-7A1.5 1.5 0 0 0 12.5 2h-7ZM12 10.5V5.5A1.5 1.5 0 0 0 10.5 4h-5v-.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H12v-.5ZM3 5.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-7Z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
    <path
      fillRule="evenodd"
      d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0L3.22 8.28a.75.75 0 0 1 1.06-1.06L7 9.94l5.72-5.72a.75.75 0 0 1 1.06 0Z"
      clipRule="evenodd"
    />
  </svg>
);
