import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedCollection } from './shared-collections';
import { captureFetch } from './test-support';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSharedCollection', () => {
  it('GETs the shared-link endpoint', async () => {
    const body = { collection: { id: 'c1' }, signals: [] };
    const calls = captureFetch(body);
    const result = await getSharedCollection('shared/slug');
    expect(result).toEqual(body);
    expect(calls[0]?.url).toBe('/api/shared/collections/shared%2Fslug');
  });
});
