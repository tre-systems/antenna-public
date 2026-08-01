import { afterEach, describe, expect, it } from 'vitest';
import { readSignalSnapshot, snapshotKey, writeSignalSnapshot } from './signal-snapshot';
import { sampleSignal, stubLocalStorage } from './test-support';

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe('signal snapshots', () => {
  it('round-trips a valid owner-scoped snapshot', () => {
    ({ restore } = stubLocalStorage());
    const snapshot = { signals: [sampleSignal('a')], fetchedAt: 123 };

    writeSignalSnapshot('user-a', 'collection-a', snapshot);

    expect(readSignalSnapshot('user-a', 'collection-a')).toEqual(snapshot);
    expect(readSignalSnapshot('user-b', 'collection-a')).toBeNull();
  });

  it('rejects malformed signal rows from local storage', () => {
    ({ restore } = stubLocalStorage());
    window.localStorage.setItem(
      snapshotKey('user-a', 'collection-a'),
      JSON.stringify({ signals: [{ id: 'incomplete' }], fetchedAt: 123 }),
    );

    expect(readSignalSnapshot('user-a', 'collection-a')).toBeNull();
  });

  it('rejects malformed server-owned display metadata', () => {
    ({ restore } = stubLocalStorage());
    const signal = { ...sampleSignal('a'), display: { title: 1 } };
    window.localStorage.setItem(
      snapshotKey('user-a', 'collection-a'),
      JSON.stringify({ signals: [signal], fetchedAt: 123 }),
    );

    expect(readSignalSnapshot('user-a', 'collection-a')).toBeNull();
  });

  it('rejects malformed point and source-policy metadata', () => {
    ({ restore } = stubLocalStorage());
    const signal = {
      ...sampleSignal('a'),
      points: [{ dimensions: {}, value: 1, observed_at: 'yesterday' }],
      source_policy: { source_id: 'source', label: 'Source', execution_mode: 'unknown' },
    };
    window.localStorage.setItem(
      snapshotKey('user-a', 'collection-a'),
      JSON.stringify({ signals: [signal], fetchedAt: 123 }),
    );

    expect(readSignalSnapshot('user-a', 'collection-a')).toBeNull();
  });
});
