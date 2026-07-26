import { vi } from 'vitest';
import type { ApiSignal } from '../api';
import { activeCollectionId, pendingRemoval, setSignalSnapshotOwner, signals } from './signals';

export const sampleSignal = (id: string): ApiSignal => ({
  id,
  template_id: 'fx-pair',
  visibility: 'private',
  config: { base: 'EUR', quote: 'USD', pair: 'EUR/USD' },
  refresh_seconds: 900,
  status: {
    status: 'live',
    last_ok_at: 0,
    last_attempt_at: 0,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [],
});

export const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

export const mockFetch = (
  impl: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): void => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

let resetCounter = 0;

// Cycling the owner clears the module-level snapshot key as well as the signals.
export const resetSignalState = (): void => {
  resetCounter += 1;
  setSignalSnapshotOwner(`test-reset-${String(resetCounter)}`);
  setSignalSnapshotOwner(null);
  signals.value = null;
  pendingRemoval.value = null;
  activeCollectionId.value = null;
};

export const stubLocalStorage = (): { readonly restore: () => void } => {
  const data = new Map<string, string>();
  const originalWindow = globalThis.window;
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  return {
    restore: () => {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    },
  };
};
