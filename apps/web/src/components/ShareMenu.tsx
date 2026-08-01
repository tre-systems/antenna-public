import { useCallback, useRef, useState } from 'preact/hooks';
import type { CollectionRecord } from '@antenna/shared';
import { ShareDisplayMatrix } from './ShareDisplayMatrix';
import { LinkIcon } from './share-menu/icons';
import { LinkRow } from './share-menu/LinkRow';
import { VISIBILITY_OPTIONS, VisibilityOption } from './share-menu/VisibilityOption';
import { useMenuDismiss } from './collection-switcher/use-menu-dismiss';

type Visibility = CollectionRecord['visibility'];

type Props = {
  readonly visibility: Visibility;
  readonly slug: string | null;
  readonly onChange: (next: Visibility) => Promise<void>;
};

// Keep policy-gated sharing behind one secondary action in the private-first workspace.
export function ShareMenu({ visibility, slug, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Visibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useMenuDismiss(open, rootRef, close);

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
        class="antenna-control inline-flex items-center justify-center gap-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-[780px]:gap-1"
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
          class="antenna-menu absolute right-0 top-11 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl p-3 text-left"
          data-testid="share-menu"
        >
          <p class="antenna-eyebrow mb-2">Visibility</p>
          <div role="group" aria-label="Collection visibility" class="space-y-1">
            {VISIBILITY_OPTIONS.map((opt) => (
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

const origin = (): string => (typeof window === 'undefined' ? '' : window.location.origin);

async function copyText(text: string): Promise<void> {
  if (typeof navigator === 'undefined') throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}
