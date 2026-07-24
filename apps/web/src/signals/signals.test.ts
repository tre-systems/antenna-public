import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiSignal } from '../api';
import {
  activeCollectionId,
  applyReorder,
  signals,
  displayedSignals,
  fetchError,
  isOffline,
  lastFetchedAt,
  loadSignals,
  loadSignalsById,
  pendingRemoval,
  reorderForDrop,
  setSignalSnapshotOwner,
  startRemoval,
  undoRemoval,
  UNDO_WINDOW_MS,
} from './signals';

const sampleSignal = (id: string): ApiSignal => ({
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

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const mockFetch = (impl: (input: RequestInfo | URL) => Response | Promise<Response>) => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

const stubLocalStorage = (): { readonly restore: () => void } => {
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

let resetCounter = 0;

beforeEach(() => {
  vi.useFakeTimers();
  resetCounter += 1;
  setSignalSnapshotOwner(`test-reset-${String(resetCounter)}`);
  setSignalSnapshotOwner(null);
  signals.value = null;
  pendingRemoval.value = null;
  activeCollectionId.value = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setSignalSnapshotOwner(`test-reset-after-${String(resetCounter)}`);
  setSignalSnapshotOwner(null);
  pendingRemoval.value = null;
  signals.value = null;
  activeCollectionId.value = null;
});

describe('signal state', () => {
  it('hides a signal in the undo window from displayedSignals but keeps it in signals', () => {
    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    expect(signals.value).toHaveLength(2);
    expect(displayedSignals.value).toHaveLength(1);
    expect(displayedSignals.value?.[0]?.id).toBe('b');
  });

  it('undoRemoval restores the signal to displayedSignals without calling DELETE', () => {
    const fetchSpy = vi.fn();
    mockFetch(fetchSpy);
    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    undoRemoval();

    expect(displayedSignals.value).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('commits the delete after the undo window elapses and refetches', async () => {
    const calls: string[] = [];
    mockFetch((input) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.endsWith('/api/signals/a')) {
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }
      return new Response(JSON.stringify([sampleSignal('b')]), { status: 200 });
    });

    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    await vi.runAllTimersAsync();

    expect(calls.some((c) => c.endsWith('/api/signals/a'))).toBe(true);
    expect(calls.some((c) => c.endsWith('/api/signals'))).toBe(true);
    expect(signals.value).toEqual([sampleSignal('b')]);
    expect(pendingRemoval.value).toBeNull();
  });

  it('starting a second removal commits the first one immediately so only one toast is in flight', () => {
    const deleted: string[] = [];
    mockFetch((input) => {
      const url = urlOf(input);
      const match = /\/api\/signals\/([^/?]+)$/.exec(url);
      if (match && match[1] && match[1] !== 'signals') {
        deleted.push(match[1]);
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    signals.value = [sampleSignal('a'), sampleSignal('b')];

    startRemoval(sampleSignal('a'));
    startRemoval(sampleSignal('b'));

    const pending = pendingRemoval.value;
    expect(pending).not.toBeNull();
    expect(pending && pending.signal.id).toBe('b');
    expect(deleted).toEqual(['a']);
  });

  it('keeps the removed card hidden between undo-window expiry and delete completion', async () => {
    // Regression: the card used to flash back after the undo window closed
    // because pendingRemoval cleared before the DELETE round-trip finished.
    let resolveDelete: ((res: Response) => void) | undefined;
    mockFetch((input) => {
      const url = urlOf(input);
      if (url.endsWith('/api/signals/a')) {
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return new Response(JSON.stringify([sampleSignal('b')]), { status: 200 });
    });

    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    await Promise.resolve();

    // Undo window closed, DELETE still in flight: the card must stay hidden
    // even though it is still present in the underlying signals list.
    expect(pendingRemoval.value).toBeNull();
    expect(signals.value.map((s) => s.id)).toContain('a');
    expect(displayedSignals.value?.map((s) => s.id)).toEqual(['b']);

    // An SSE-style refetch landing mid-delete must not resurrect the card.
    await loadSignals();
    expect(displayedSignals.value?.map((s) => s.id)).toEqual(['b']);

    resolveDelete?.(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    await vi.runAllTimersAsync();
    expect(displayedSignals.value?.map((s) => s.id)).toEqual(['b']);
  });
});

describe('reorderForDrop', () => {
  it('moves the dragged signal to the target position', () => {
    const list = [sampleSignal('a'), sampleSignal('b'), sampleSignal('c'), sampleSignal('d')];
    const next = reorderForDrop(list, 'd', 'b');
    expect(next.map((b) => b.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('swaps with the immediate next neighbour instead of being a no-op', () => {
    // Regression: insert-before-target semantics made a one-slot forward
    // drag do nothing.
    const list = [sampleSignal('a'), sampleSignal('b'), sampleSignal('c')];
    const next = reorderForDrop(list, 'a', 'b');
    expect(next.map((b) => b.id)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op when dragged === target', () => {
    const list = [sampleSignal('a'), sampleSignal('b')];
    expect(reorderForDrop(list, 'a', 'a')).toBe(list);
  });

  it('is a no-op when either id is unknown', () => {
    const list = [sampleSignal('a'), sampleSignal('b')];
    expect(reorderForDrop(list, 'x', 'a')).toBe(list);
    expect(reorderForDrop(list, 'a', 'x')).toBe(list);
  });
});

describe('applyReorder', () => {
  beforeEach(() => {
    fetchError.value = null;
  });

  it('optimistically reorders and persists via PATCH', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        calls.push({
          url,
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? init.body : undefined,
        });
        if (url.endsWith('/api/collection/signals/order')) {
          return Promise.resolve(
            new Response(JSON.stringify({ updated: true, ordered_signal_ids: ['b', 'a'] }), {
              status: 200,
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([sampleSignal('b'), sampleSignal('a')]), { status: 200 }),
        );
      }),
    );

    signals.value = [sampleSignal('a'), sampleSignal('b')];
    await applyReorder([sampleSignal('b'), sampleSignal('a')]);

    const order = calls.find((c) => c.url.endsWith('/api/collection/signals/order'));
    expect(order?.method).toBe('PATCH');
    expect(order?.body).toBe(JSON.stringify({ ordered_signal_ids: ['b', 'a'] }));
    expect(signals.value).toEqual([sampleSignal('b'), sampleSignal('a')]);
    expect(fetchError.value).toBeNull();
  });

  it('persists reorder through the collection-scoped route when a collection is active', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        calls.push({ url, method: init?.method ?? 'GET' });
        if (url.endsWith('/api/collections/collection%2F1/signals/order')) {
          return Promise.resolve(
            new Response(JSON.stringify({ updated: true, ordered_signal_ids: ['b', 'a'] }), {
              status: 200,
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([sampleSignal('b'), sampleSignal('a')]), { status: 200 }),
        );
      }),
    );

    activeCollectionId.value = 'collection/1';
    signals.value = [sampleSignal('a'), sampleSignal('b')];
    await applyReorder([sampleSignal('b'), sampleSignal('a')]);

    expect(
      calls.some((call) => call.url.endsWith('/api/collections/collection%2F1/signals/order')),
    ).toBe(true);
  });

  it('rolls back the optimistic order and surfaces the error when the server rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.endsWith('/api/collection/signals/order') && init?.method === 'PATCH') {
          return Promise.resolve(new Response('invalid_order_signals', { status: 400 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify([sampleSignal('a'), sampleSignal('b')]), { status: 200 }),
        );
      }),
    );

    const before = [sampleSignal('a'), sampleSignal('b')];
    signals.value = before;

    await applyReorder([sampleSignal('b'), sampleSignal('a')]);

    expect(signals.value).toStrictEqual(before);
    expect(fetchError.value).not.toBeNull();
  });

  it('rolls back to an explicit pre-drag order when the preview already mutated state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.endsWith('/api/collection/signals/order') && init?.method === 'PATCH') {
          return Promise.resolve(new Response('invalid_order_signals', { status: 400 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify([sampleSignal('a'), sampleSignal('b')]), { status: 200 }),
        );
      }),
    );

    const original = [sampleSignal('a'), sampleSignal('b')];
    // Pointer drags preview the new order in place before persisting, so at
    // persist time signals.value already holds the new order.
    signals.value = [sampleSignal('b'), sampleSignal('a')];

    await applyReorder([sampleSignal('b'), sampleSignal('a')], original);

    expect(signals.value).toStrictEqual(original);
    expect(fetchError.value).not.toBeNull();
  });
});

describe('loadSignals offline behaviour', () => {
  beforeEach(() => {
    isOffline.value = false;
    lastFetchedAt.value = null;
  });

  afterEach(() => {
    isOffline.value = false;
    lastFetchedAt.value = null;
  });

  it('clears the offline flag and stamps lastFetchedAt on a successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify([sampleSignal('a')]), { status: 200 })),
      ),
    );
    isOffline.value = true;

    await loadSignals();

    expect(isOffline.value).toBe(false);
    expect(lastFetchedAt.value).not.toBeNull();
    expect(signals.value).toEqual([sampleSignal('a')]);
  });

  it('loads signals through the collection-scoped list route when active', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        calls.push(urlOf(input));
        return Promise.resolve(new Response(JSON.stringify([sampleSignal('a')]), { status: 200 }));
      }),
    );

    activeCollectionId.value = 'collection/1';
    await loadSignals();

    expect(calls[0]).toBe('/api/signals?collection_id=collection%2F1');
  });

  it('keeps offline snapshots scoped to the signed-in owner', async () => {
    const { restore } = stubLocalStorage();
    try {
      setSignalSnapshotOwner('user-a');
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(new Response(JSON.stringify([sampleSignal('a')]), { status: 200 })),
        ),
      );

      await loadSignals('collection-1');
      expect(signals.value).toEqual([sampleSignal('a')]);

      setSignalSnapshotOwner('user-b');
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('network down'))),
      );

      await loadSignals('collection-1');

      expect(signals.value).toBeNull();
      expect(fetchError.value).toBe('network down');
    } finally {
      restore();
    }
  });

  it('merges targeted signal refetches into the cached signal list', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = urlOf(input);
        calls.push(url);
        if (url.endsWith('/api/signals/c')) {
          return Promise.resolve(new Response(JSON.stringify(sampleSignal('c')), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }),
    );

    signals.value = [sampleSignal('a')];
    await loadSignalsById(['c']);

    expect(calls).toEqual(['/api/signals/c']);
    expect(signals.value.map((signal) => signal.id)).toEqual(['a', 'c']);
  });

  it('keeps cached signals visible and flips offline when a fetch fails with prior data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    signals.value = [sampleSignal('a')];

    await loadSignals();

    expect(signals.value).toEqual([sampleSignal('a')]);
    expect(isOffline.value).toBe(true);
    expect(fetchError.value).toBe('network down');
  });
});
