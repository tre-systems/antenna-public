import { computed, signal } from '@preact/signals';
import {
  deleteSignal,
  getSignal,
  getSignals,
  reorderSignals as reorderSignalsApi,
  type ApiSignal,
} from '../api';
import { readSignalSnapshot, snapshotKey, writeSignalSnapshot } from './signal-snapshot';

export { reorderForDrop } from './signal-order';

// Null collection keeps the primary-collection compatibility path.
export const activeCollectionId = signal<string | null>(null);
const activeSnapshotOwnerId = signal<string | null>(null);

export const signals = signal<ApiSignal[] | null>(null);
export const fetchError = signal<string | null>(null);

export const isOffline = signal<boolean>(false);
export const lastFetchedAt = signal<number | null>(null);

let currentSnapshotKey: string | null = null;

type PendingRemoval = {
  readonly signal: ApiSignal;
  readonly expiresAt: number;
  readonly timeoutId: ReturnType<typeof setTimeout>;
};

export const pendingRemoval = signal<PendingRemoval | null>(null);

// Signals whose DELETE round-trip is in flight. They stay hidden after the
// undo window closes so the card cannot flash back between the undo toast
// disappearing and the refetch confirming the deletion — including when an
// SSE-triggered refetch lands mid-delete.
const deletingIds = signal<ReadonlySet<string>>(new Set());

export const draggingSignalId = signal<string | null>(null);

export const settingsSignalId = signal<string | null>(null);

// Keeps SSE refetches from visually undoing an active optimistic removal.
export const displayedSignals = computed(() => {
  const all = signals.value;
  if (all === null) return null;
  const pending = pendingRemoval.value;
  const deleting = deletingIds.value;
  if (!pending && deleting.size === 0) return all;
  return all.filter((item) => item.id !== pending?.signal.id && !deleting.has(item.id));
});

export const UNDO_WINDOW_MS = 5000;

// Transient success/status message (e.g. after creating a signal). It auto-
// dismisses; a lightweight cousin of the undo toast.
export const notice = signal<string | null>(null);
export const NOTICE_WINDOW_MS = 5000;
let noticeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function showNotice(message: string): void {
  if (noticeTimeoutId) clearTimeout(noticeTimeoutId);
  notice.value = message;
  noticeTimeoutId = setTimeout(() => {
    notice.value = null;
    noticeTimeoutId = null;
  }, NOTICE_WINDOW_MS);
}

export function dismissNotice(): void {
  if (noticeTimeoutId) {
    clearTimeout(noticeTimeoutId);
    noticeTimeoutId = null;
  }
  notice.value = null;
}

export function setSignalSnapshotOwner(ownerId: string | null): void {
  if (activeSnapshotOwnerId.value === ownerId) return;
  activeSnapshotOwnerId.value = ownerId;
  signals.value = null;
  lastFetchedAt.value = null;
  currentSnapshotKey = null;
}

export async function loadSignals(
  collectionId: string | null = activeCollectionId.value,
  ownerId: string | null = activeSnapshotOwnerId.value,
): Promise<void> {
  hydrateSnapshotForScope(ownerId, collectionId);
  try {
    const next = await getSignals(collectionId ?? undefined);
    setSignalsFromFreshFetch(next, ownerId, collectionId);
  } catch (err) {
    handleSignalsFetchError(err);
  }
}

export async function loadSignalsById(signalIds: readonly string[]): Promise<void> {
  if (signalIds.length === 0) return;
  if (signals.value === null) {
    await loadSignals();
    return;
  }
  try {
    const fresh = await Promise.all(signalIds.map((id) => getSignal(id)));
    const byId = new Map(signals.value.map((item) => [item.id, item]));
    for (const item of fresh) byId.set(item.id, item);
    setSignalsFromFreshFetch(
      [...byId.values()],
      activeSnapshotOwnerId.value,
      activeCollectionId.value,
    );
  } catch {
    await loadSignals();
  }
}

function setSignalsFromFreshFetch(
  next: ApiSignal[],
  ownerId: string | null,
  collectionId: string | null,
): void {
  signals.value = next;
  fetchError.value = null;
  isOffline.value = false;
  const fetchedAt = Date.now();
  lastFetchedAt.value = fetchedAt;
  currentSnapshotKey = snapshotKey(ownerId, collectionId);
  writeSignalSnapshot(ownerId, collectionId, { signals: next, fetchedAt });
}

function hydrateSnapshotForScope(ownerId: string | null, collectionId: string | null): void {
  const key = snapshotKey(ownerId, collectionId);
  if (currentSnapshotKey === key && signals.value !== null) return;
  if (currentSnapshotKey === null && signals.value !== null) {
    currentSnapshotKey = key;
    return;
  }

  const snap = readSignalSnapshot(ownerId, collectionId);
  signals.value = snap?.signals ?? null;
  lastFetchedAt.value = snap?.fetchedAt ?? null;
  currentSnapshotKey = key;
}

function handleSignalsFetchError(err: unknown): void {
  fetchError.value = err instanceof Error ? err.message : 'Failed to load signals.';
  const browserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if ((signals.value !== null && signals.value.length > 0) || browserOffline) {
    isOffline.value = true;
  }
}

// Commit any older pending removal before starting a new undo window.
export function startRemoval(signalToRemove: ApiSignal): void {
  const existing = pendingRemoval.value;
  if (existing) {
    clearTimeout(existing.timeoutId);
    markDeleting(existing.signal.id);
    void runDelete(existing.signal.id);
  }
  const timeoutId = setTimeout(() => {
    void commitRemoval(signalToRemove.id);
  }, UNDO_WINDOW_MS);
  pendingRemoval.value = {
    signal: signalToRemove,
    expiresAt: Date.now() + UNDO_WINDOW_MS,
    timeoutId,
  };
}

export function undoRemoval(): void {
  const pending = pendingRemoval.value;
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingRemoval.value = null;
}

async function commitRemoval(signalId: string): Promise<void> {
  const pending = pendingRemoval.value;
  if (!pending || pending.signal.id !== signalId) return;
  // Hide via deletingIds before dropping the undo state so the card never
  // reappears in the gap while the DELETE round-trip runs.
  markDeleting(signalId);
  pendingRemoval.value = null;
  await runDelete(signalId);
}

function markDeleting(signalId: string): void {
  if (deletingIds.value.has(signalId)) return;
  deletingIds.value = new Set([...deletingIds.value, signalId]);
}

function unmarkDeleting(signalId: string): void {
  if (!deletingIds.value.has(signalId)) return;
  const next = new Set(deletingIds.value);
  next.delete(signalId);
  deletingIds.value = next;
}

async function runDelete(signalId: string): Promise<void> {
  markDeleting(signalId);
  try {
    await deleteSignal(signalId);
  } catch {
    // The refetch below restores the server's truth either way.
  }
  try {
    await loadSignals();
  } finally {
    unmarkDeleting(signalId);
  }
}

// `rollbackTo` is the order to restore if the server rejects the reorder.
// It defaults to the current list, but callers that already previewed the
// new order optimistically (pointer drag) must pass the pre-drag order.
export async function applyReorder(
  nextOrder: readonly ApiSignal[],
  rollbackTo: readonly ApiSignal[] | null = signals.value,
): Promise<void> {
  signals.value = [...nextOrder];
  try {
    await reorderSignalsApi(
      nextOrder.map((item) => item.id),
      activeCollectionId.value ?? undefined,
    );
    await loadSignals();
  } catch (err) {
    signals.value = rollbackTo === null ? null : [...rollbackTo];
    fetchError.value = err instanceof Error ? err.message : 'Could not save the new order.';
  }
}
