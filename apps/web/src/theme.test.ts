import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIG_MATCH_MEDIA = globalThis.matchMedia;
const ORIG_LOCAL_STORAGE = globalThis.localStorage;
const ORIG_WINDOW = (globalThis as { window?: unknown }).window;

type MediaQueryListLike = {
  matches: boolean;
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
};

const stubMatchMedia = (prefersDark: boolean): MediaQueryListLike => {
  const listeners = new Set<() => void>();
  const mql: MediaQueryListLike = {
    matches: prefersDark,
    addEventListener: (_, l) => listeners.add(l),
    removeEventListener: (_, l) => {
      listeners.delete(l);
    },
  };
  const matchMediaFn = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  globalThis.matchMedia = matchMediaFn;
  // theme.ts guards on `typeof window !== 'undefined'`, so we need a real
  // window object that exposes the same stub.
  // @ts-expect-error overriding for the test environment
  globalThis.window = { matchMedia: matchMediaFn };
  return mql;
};

const stubLocalStorage = (initial: Record<string, string> = {}) => {
  const store = new Map<string, string>(Object.entries(initial));
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  globalThis.localStorage = storage;
  const existingWindow = (globalThis as unknown as { window?: { localStorage?: Storage } }).window;
  // @ts-expect-error overriding for the test environment
  globalThis.window = existingWindow
    ? Object.assign(existingWindow, { localStorage: storage })
    : { localStorage: storage };
  return store;
};

const stubDocument = () => {
  const classes = new Set<string>();
  const documentLike = {
    documentElement: {
      classList: {
        toggle: (cls: string, force?: boolean) => {
          const wants = force ?? !classes.has(cls);
          if (wants) classes.add(cls);
          else classes.delete(cls);
        },
        contains: (cls: string) => classes.has(cls),
      },
    },
  };
  // @ts-expect-error overriding for the test environment
  globalThis.document = documentLike;
  return classes;
};

describe('theme', () => {
  afterEach(() => {
    globalThis.matchMedia = ORIG_MATCH_MEDIA;
    globalThis.localStorage = ORIG_LOCAL_STORAGE;
    // @ts-expect-error restore optional global
    globalThis.window = ORIG_WINDOW;
    vi.resetModules();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('resolves system → dark when prefers-color-scheme matches', async () => {
    stubMatchMedia(true);
    stubLocalStorage();
    const mod = await import('./theme');
    expect(mod.resolveTheme('system')).toBe('dark');
  });

  it('resolves system → light when prefers-color-scheme does not match', async () => {
    stubMatchMedia(false);
    stubLocalStorage();
    const mod = await import('./theme');
    expect(mod.resolveTheme('system')).toBe('light');
  });

  it('seeds themeChoice from localStorage', async () => {
    stubMatchMedia(false);
    stubLocalStorage({ 'antenna.theme': 'dark' });
    const mod = await import('./theme');
    expect(mod.themeChoice.value).toBe('dark');
  });

  it('setTheme persists and applies the .dark class', async () => {
    stubMatchMedia(false);
    const store = stubLocalStorage();
    const classes = stubDocument();
    const mod = await import('./theme');
    mod.setTheme('dark');
    expect(store.get('antenna.theme')).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    mod.setTheme('light');
    expect(store.get('antenna.theme')).toBe('light');
    expect(classes.has('dark')).toBe(false);
    mod.setTheme('system');
    expect(store.has('antenna.theme')).toBe(false);
  });
});
