import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSignal,
  getSignal,
  getSignalHistory,
  getSignals,
  reorderSignals,
  updateSignal,
} from './signals';
import { captureFetch } from './test-support';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api signal endpoints', () => {
  it('getSignals can scope the list endpoint to one collection id', async () => {
    const calls = captureFetch([]);
    await getSignals('collection/with spaces');
    expect(calls[0]?.url).toBe('/api/signals?collection_id=collection%2Fwith+spaces');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getSignal GETs one encoded owner-scoped signal', async () => {
    const calls = captureFetch({ id: 'signal/with spaces' });
    const result = await getSignal('signal/with spaces');
    expect(result.id).toBe('signal/with spaces');
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getSignalHistory GETs the signal history endpoint with a range', async () => {
    const calls = captureFetch({ points: [] });
    const result = await getSignalHistory('signal/with spaces', '6m');
    expect(result).toEqual({ points: [] });
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces/history?range=6m');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('updateSignal PATCHes config and refresh changes to the signal endpoint', async () => {
    const calls = captureFetch({
      updated: true,
      config: { base: 'GBP', quote: 'USD' },
      refresh_seconds: 600,
      cleared_points: true,
    });
    const result = await updateSignal('signal/with spaces', {
      config: { base: 'GBP' },
      refresh_seconds: 600,
    });
    expect(result.updated).toBe(true);
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ config: { base: 'GBP' }, refresh_seconds: 600 }),
    );
  });

  it('deleteSignal DELETEs the encoded signal endpoint', async () => {
    const calls = captureFetch({ deleted: true });
    const result = await deleteSignal('signal/with spaces');
    expect(result.deleted).toBe(true);
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('reorderSignals uses the collection-scoped route when a collection id is provided', async () => {
    const calls = captureFetch({ updated: true, ordered_signal_ids: ['b', 'a'] });
    await reorderSignals(['b', 'a'], 'collection/with spaces');
    expect(calls[0]?.url).toBe('/api/collections/collection%2Fwith%20spaces/signals/order');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ ordered_signal_ids: ['b', 'a'] }));
  });
});
