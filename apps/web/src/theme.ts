import { signal } from '@preact/signals';

export type ThemeChoice = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'antenna.theme';

const safeStorage = (): Storage | null => {
  try {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    if (typeof storage?.getItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
};

const readStored = (): ThemeChoice => {
  const v = safeStorage()?.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
};

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const themeChoice = signal<ThemeChoice>(readStored());

export const resolveTheme = (choice: ThemeChoice): ResolvedTheme =>
  choice === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : choice;

const applyResolved = (resolved: ResolvedTheme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
};

export const setTheme = (next: ThemeChoice): void => {
  themeChoice.value = next;
  const storage = safeStorage();
  if (storage) {
    if (next === 'system') storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, next);
  }
  applyResolved(resolveTheme(next));
};

// Keep the page in sync with the OS when the user has chosen 'system'.
export const watchSystemTheme = (): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (themeChoice.value === 'system') applyResolved(resolveTheme('system'));
  };
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
};
