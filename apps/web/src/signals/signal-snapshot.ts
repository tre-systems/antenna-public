import type { ApiSignal } from '../api';

const SNAPSHOT_KEY_PREFIX = 'antenna.signals.snapshot.v2';

type SignalSnapshot = {
  readonly signals: ApiSignal[];
  readonly fetchedAt: number;
};

export const snapshotKey = (ownerId: string | null, collectionId: string | null): string =>
  `${SNAPSHOT_KEY_PREFIX}:${ownerId ?? 'unknown'}:${collectionId ?? 'primary'}`;

export const readSignalSnapshot = (
  ownerId: string | null,
  collectionId: string | null,
): SignalSnapshot | null => {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(snapshotKey(ownerId, collectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSignalSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeSignalSnapshot = (
  ownerId: string | null,
  collectionId: string | null,
  snap: SignalSnapshot,
): void => {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(snapshotKey(ownerId, collectionId), JSON.stringify(snap));
  } catch {
    // Storage is best-effort; quota and private mode failures should not signal rendering.
  }
};

const safeStorage = (): Storage | null => {
  try {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    if (typeof storage?.getItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
};

const isSignalSnapshot = (value: unknown): value is SignalSnapshot => {
  if (value === null || typeof value !== 'object') return false;
  const maybe = value as SignalSnapshot;
  return Array.isArray(maybe.signals) && typeof maybe.fetchedAt === 'number';
};
