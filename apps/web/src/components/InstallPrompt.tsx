// Safari installs through its Share menu and never emits beforeinstallprompt.

import { useEffect, useState } from 'preact/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'antenna.install.dismissed';

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // localStorage throws in private mode; worst case we offer install again.
    }
    const handler = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (event === null) return null;

  const handleInstall = async (): Promise<void> => {
    setBusy(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'dismissed') {
        try {
          localStorage.setItem(DISMISSED_KEY, '1');
        } catch {
          /* private mode — fine, just won't persist */
        }
      }
    } finally {
      setEvent(null);
      setBusy(false);
    }
  };

  const handleDismiss = (): void => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* private mode — fine, just won't persist */
    }
    setEvent(null);
  };

  return (
    <span
      class="inline-flex items-center overflow-hidden rounded-lg bg-white/50 ring-1 ring-slate-900/10 dark:bg-white/5 dark:ring-white/10"
      data-testid="install-prompt"
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void handleInstall();
        }}
        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/80 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M8 2v8m0 0l-3-3m3 3l3-3" />
          <path d="M3 13h10" />
        </svg>
        {busy ? 'Installing…' : 'Install'}
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        title="Dismiss"
        onClick={handleDismiss}
        disabled={busy}
        class="inline-flex h-full items-center border-l border-slate-900/10 px-2 text-slate-500 transition hover:bg-white/80 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-3 w-3"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </span>
  );
}
