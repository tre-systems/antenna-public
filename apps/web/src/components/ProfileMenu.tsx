import { useEffect, useRef, useState } from 'preact/hooks';
import type { User } from '../auth';
import { firstName, greetingFor } from '../auth';
import { refreshInstalledApp } from '../pwa-update';
import { ThemeToggle } from './ThemeToggle';

type Props = {
  readonly user: User;
  readonly signingOut: boolean;
  readonly onSignOut: () => void;
};

export function ProfileMenu({ user, signingOut, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Outside-click and Escape close the menu.  Same pattern as CollectionSwitcher.
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

  const initials = getInitials(user);
  const greeting = `${greetingFor()}, ${firstName(user)}`;
  const showAvatar = user.image_url !== null && !avatarFailed;

  useEffect(() => {
    setAvatarFailed(false);
  }, [user.image_url]);

  const handleUpdateApp = async (): Promise<void> => {
    if (updatingApp) return;
    setUpdatingApp(true);
    try {
      await refreshInstalledApp();
    } finally {
      setUpdatingApp(false);
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu — ${greeting}`}
        title={greeting}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        class={`inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(13,123,60,0.45)] ring-1 ring-white/20 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
          showAvatar ? 'bg-slate-800/40 dark:bg-white/10' : 'bg-emerald-700 dark:bg-emerald-500'
        }`}
        data-testid="profile-menu-trigger"
      >
        {showAvatar ? (
          <img
            src={user.image_url}
            alt=""
            class="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => {
              setAvatarFailed(true);
            }}
          />
        ) : (
          initials
        )}
      </button>
      {open ? (
        <div
          role="menu"
          class="antenna-menu absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-lg"
          data-testid="profile-menu"
        >
          <div class="border-b border-slate-200 px-3 py-3 dark:border-white/10">
            <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
              {user.name || firstName(user)}
            </p>
            <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
          <div class="border-b border-slate-200 px-3 py-3 dark:border-white/10">
            <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Theme
            </p>
            <ThemeToggle />
          </div>
          <div class="py-1">
            <a
              href="/settings/activity"
              role="menuitem"
              class="block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-slate-200 dark:hover:bg-white/5"
              data-testid="profile-menu-activity"
            >
              Activity &amp; diagnostics
            </a>
            <a
              href="/settings/tokens"
              role="menuitem"
              class="block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-slate-200 dark:hover:bg-white/5"
              data-testid="profile-menu-tokens"
            >
              Agent access
            </a>
            <button
              type="button"
              role="menuitem"
              disabled={updatingApp}
              onClick={() => {
                void handleUpdateApp();
              }}
              class="block w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-wait disabled:opacity-60 dark:text-slate-200 dark:hover:bg-white/5"
              data-testid="profile-menu-update-app"
            >
              {updatingApp ? 'Checking for update…' : 'Update app'}
            </button>
          </div>
          <div class="border-t border-slate-200 py-1 dark:border-white/10">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={onSignOut}
              class="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/5"
              data-testid="profile-menu-signout"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// The trailing dot keeps the avatar from ever collapsing to empty.
const getInitials = (user: User): string => {
  const name = user.name.trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    const letters = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
    if (letters.length > 0) return letters;
  }
  return user.email[0]?.toUpperCase() ?? '·';
};
