import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSignals, setSignalSnapshotOwner, signals, isOffline } from './signals';
import {
  readSignalSnapshot,
  snapshotKey,
  SNAPSHOT_MAX_AGE_MS,
  writeSignalSnapshot,
} from './signal-snapshot';
import {
  jsonResponse,
  mockFetch,
  resetSignalState,
  sampleSignal,
  stubLocalStorage,
} from './test-support';
import { signOut } from '../auth';

let restore: () => void;
beforeEach(() => {
  resetSignalState();
  ({ restore } = stubLocalStorage());
  setSignalSnapshotOwner('owner-a');
});
afterEach(() => {
  restore();
  vi.unstubAllGlobals();
  resetSignalState();
});

const save = (owner = 'owner-a', fetchedAt = Date.now()): void => {
  writeSignalSnapshot(owner, null, { signals: [sampleSignal('private')], fetchedAt });
};

describe('private snapshot lifecycle', () => {
  it('purges every saved collection on successful sign-out, preserving unrelated preferences', async () => {
    save();
    writeSignalSnapshot('owner-a', 'second', {
      signals: [sampleSignal('other')],
      fetchedAt: Date.now(),
    });
    window.localStorage.setItem('theme', 'dark');
    mockFetch(() => jsonResponse({ success: true }));
    await signOut();
    expect(window.localStorage.getItem(snapshotKey('owner-a', null))).toBeNull();
    expect(window.localStorage.getItem(snapshotKey('owner-a', 'second'))).toBeNull();
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(signals.value).toBeNull();
  });

  it.each([401, 403])(
    'clears cached private data on HTTP %s, without offline fallback',
    async (status) => {
      save();
      mockFetch(() => jsonResponse({ error: 'unauthorized' }, status));
      await loadSignals();
      expect(signals.value).toBeNull();
      expect(isOffline.value).toBe(false);
      expect(readSignalSnapshot('owner-a', null)).toBeNull();
    },
  );

  it('expires old snapshots but retains a recent snapshot during a genuine network failure', async () => {
    save('owner-a', Date.now() - SNAPSHOT_MAX_AGE_MS);
    expect(readSignalSnapshot('owner-a', null)).toBeNull();
    save();
    mockFetch(() => Promise.reject(new Error('network down')));
    await loadSignals();
    expect(signals.value).toEqual([sampleSignal('private')]);
    expect(isOffline.value).toBe(true);
  });

  it('does not invalidate a new owner when an old request eventually returns 401', async () => {
    let resolve: (response: Response) => void = () => undefined;
    mockFetch(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const pending = loadSignals();
    setSignalSnapshotOwner('owner-b');
    save('owner-b');
    resolve(jsonResponse({}, 401));
    await pending;
    expect(readSignalSnapshot('owner-b', null)).not.toBeNull();
  });
});
