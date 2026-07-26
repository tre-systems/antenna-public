import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeCollectionId,
  fetchError,
  isOffline,
  lastFetchedAt,
  loadSignals,
  loadSignalsById,
  setSignalSnapshotOwner,
  signals,
} from './signals';
import {
  jsonResponse,
  mockFetch,
  resetSignalState,
  sampleSignal,
  stubLocalStorage,
  urlOf,
} from './test-support';

const resetLoadState = (): void => {
  resetSignalState();
  isOffline.value = false;
  lastFetchedAt.value = null;
};

beforeEach(resetLoadState);

afterEach(() => {
  vi.unstubAllGlobals();
  resetLoadState();
});

describe('loadSignals offline behaviour', () => {
  it('clears the offline flag and stamps lastFetchedAt on a successful fetch', async () => {
    mockFetch(() => jsonResponse([sampleSignal('a')]));
    isOffline.value = true;

    await loadSignals();

    expect(isOffline.value).toBe(false);
    expect(lastFetchedAt.value).not.toBeNull();
    expect(signals.value).toEqual([sampleSignal('a')]);
  });

  it('loads signals through the collection-scoped list route when active', async () => {
    const calls: string[] = [];
    mockFetch((input) => {
      calls.push(urlOf(input));
      return jsonResponse([sampleSignal('a')]);
    });

    activeCollectionId.value = 'collection/1';
    await loadSignals();

    expect(calls[0]).toBe('/api/signals?collection_id=collection%2F1');
  });

  it('keeps offline snapshots scoped to the signed-in owner', async () => {
    const { restore } = stubLocalStorage();
    try {
      setSignalSnapshotOwner('user-a');
      mockFetch(() => jsonResponse([sampleSignal('a')]));

      await loadSignals('collection-1');
      expect(signals.value).toEqual([sampleSignal('a')]);

      setSignalSnapshotOwner('user-b');
      mockFetch(() => Promise.reject(new Error('network down')));

      await loadSignals('collection-1');

      expect(signals.value).toBeNull();
      expect(fetchError.value).toBe('network down');
    } finally {
      restore();
    }
  });

  it('merges targeted signal refetches into the cached signal list', async () => {
    const calls: string[] = [];
    mockFetch((input) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.endsWith('/api/signals/c')) return jsonResponse(sampleSignal('c'));
      return jsonResponse([]);
    });

    signals.value = [sampleSignal('a')];
    await loadSignalsById(['c']);

    expect(calls).toEqual(['/api/signals/c']);
    expect(signals.value.map((signal) => signal.id)).toEqual(['a', 'c']);
  });

  it('keeps cached signals visible and flips offline when a fetch fails with prior data', async () => {
    mockFetch(() => Promise.reject(new Error('network down')));
    signals.value = [sampleSignal('a')];

    await loadSignals();

    expect(signals.value).toEqual([sampleSignal('a')]);
    expect(isOffline.value).toBe(true);
    expect(fetchError.value).toBe('network down');
  });
});
