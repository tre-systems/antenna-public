import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeCollectionId, applyReorder, fetchError, signals } from './signals';
import { jsonResponse, mockFetch, resetSignalState, sampleSignal, urlOf } from './test-support';

const ORDER_PATH = '/api/collection/signals/order';

beforeEach(() => {
  resetSignalState();
  fetchError.value = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSignalState();
});

// Fails the order PATCH so the caller has to roll back; every other route lists a, b.
const mockRejectedReorder = (): void => {
  mockFetch((input, init) => {
    if (urlOf(input).endsWith(ORDER_PATH) && init?.method === 'PATCH') {
      return new Response('invalid_order_signals', { status: 400 });
    }
    return jsonResponse([sampleSignal('a'), sampleSignal('b')]);
  });
};

describe('applyReorder', () => {
  it('optimistically reorders and persists via PATCH', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    mockFetch((input, init) => {
      const url = urlOf(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      if (url.endsWith(ORDER_PATH)) {
        return jsonResponse({ updated: true, ordered_signal_ids: ['b', 'a'] });
      }
      return jsonResponse([sampleSignal('b'), sampleSignal('a')]);
    });

    signals.value = [sampleSignal('a'), sampleSignal('b')];
    await applyReorder([sampleSignal('b'), sampleSignal('a')]);

    const order = calls.find((c) => c.url.endsWith(ORDER_PATH));
    expect(order?.method).toBe('PATCH');
    expect(order?.body).toBe(JSON.stringify({ ordered_signal_ids: ['b', 'a'] }));
    expect(signals.value).toEqual([sampleSignal('b'), sampleSignal('a')]);
    expect(fetchError.value).toBeNull();
  });

  it('persists reorder through the collection-scoped route when a collection is active', async () => {
    const scopedPath = '/api/collections/collection%2F1/signals/order';
    const calls: string[] = [];
    mockFetch((input) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.endsWith(scopedPath)) {
        return jsonResponse({ updated: true, ordered_signal_ids: ['b', 'a'] });
      }
      return jsonResponse([sampleSignal('b'), sampleSignal('a')]);
    });

    activeCollectionId.value = 'collection/1';
    signals.value = [sampleSignal('a'), sampleSignal('b')];
    await applyReorder([sampleSignal('b'), sampleSignal('a')]);

    expect(calls.some((url) => url.endsWith(scopedPath))).toBe(true);
  });

  it('rolls back the optimistic order and surfaces the error when the server rejects', async () => {
    mockRejectedReorder();

    const before = [sampleSignal('a'), sampleSignal('b')];
    signals.value = before;

    await applyReorder([sampleSignal('b'), sampleSignal('a')]);

    expect(signals.value).toStrictEqual(before);
    expect(fetchError.value).not.toBeNull();
  });

  it('rolls back to an explicit pre-drag order when the preview already mutated state', async () => {
    mockRejectedReorder();

    const original = [sampleSignal('a'), sampleSignal('b')];
    // Pointer drags preview the new order, so signals.value already holds it at persist time.
    signals.value = [sampleSignal('b'), sampleSignal('a')];

    await applyReorder([sampleSignal('b'), sampleSignal('a')], original);

    expect(signals.value).toStrictEqual(original);
    expect(fetchError.value).not.toBeNull();
  });
});
