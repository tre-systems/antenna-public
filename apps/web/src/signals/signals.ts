import { computed, signal } from '@preact/signals';
import {
  deleteSignal,
  getSignal,
  getSignals,
  reorderSignals as reorderSignalsApi,
  type ApiSignal,
} from '../api';
import { readSignalSnapshot, snapshotKey, writeSignalSnapshot } from './signal-snapshot';
import { dismissNotice } from './notice';
import { resetPlanState } from './plan';

export { reorderForDrop } from './signal-order';
export { dismissNotice, notice, showNotice } from './notice';

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

// In-flight DELETEs stay hidden past the undo window so the card cannot flash back mid-refetch.
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

export function setSignalSnapshotOwner(ownerId: string | null): void {
  if (activeSnapshotOwnerId.value === ownerId) return;
  resetOwnerState();
  activeSnapshotOwnerId.value = ownerId;
  signals.value = null;
  lastFetchedAt.value = null;
  currentSnapshotKey = null;
}

function resetOwnerState(): void {
  const pending = pendingRemoval.value;
  if (pending) clearTimeout(pending.timeoutId);
  pendingRemoval.value = null;
  deletingIds.value = new Set();
  draggingSignalId.value = null;
  settingsSignalId.value = null;
  fetchError.value = null;
  isOffline.value = false;
  dismissNotice();
  resetPlanState();
}

export async function loadSignals(
  collectionId: string | null = activeCollectionId.value,
  ownerId: string | null = activeSnapshotOwnerId.value,
): Promise<void> {
  const activeCollectionAtStart = activeCollectionId.value;
  hydrateSnapshotForScope(ownerId, collectionId);
  try {
    const next = await getSignals(collectionId ?? undefined);
    if (!isActiveScope(ownerId, activeCollectionAtStart)) return;
    setSignalsFromFreshFetch(next, ownerId, collectionId);
  } catch (err) {
    if (isActiveScope(ownerId, activeCollectionAtStart)) handleSignalsFetchError(err);
  }
}

export async function loadSignalsById(signalIds: readonly string[]): Promise<void> {
  if (signalIds.length === 0) return;
  const ownerId = activeSnapshotOwnerId.value;
  const collectionId = activeCollectionId.value;
  if (signals.value === null) {
    await loadSignals(collectionId, ownerId);
    return;
  }
  try {
    const fresh = await Promise.all(signalIds.map((id) => getSignal(id)));
    const current = signalsForScope(ownerId, collectionId);
    if (current === null) return;
    const byId = new Map(current.map((item) => [item.id, item]));
    for (const item of fresh) byId.set(item.id, item);
    setSignalsFromFreshFetch([...byId.values()], ownerId, collectionId);
  } catch {
    if (isActiveScope(ownerId, collectionId)) await loadSignals(collectionId, ownerId);
  }
}

function isActiveScope(ownerId: string | null, collectionId: string | null): boolean {
  return activeSnapshotOwnerId.value === ownerId && activeCollectionId.value === collectionId;
}

function signalsForScope(ownerId: string | null, collectionId: string | null): ApiSignal[] | null {
  return isActiveScope(ownerId, collectionId) ? signals.value : null;
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
  // Preserve hiding between the undo state and the DELETE response.
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
  const ownerId = activeSnapshotOwnerId.value;
  const collectionId = activeCollectionId.value;
  markDeleting(signalId);
  try {
    await deleteSignal(signalId);
  } catch {
    // The refetch below restores the server's truth either way.
  }
  try {
    if (isActiveScope(ownerId, collectionId)) await loadSignals(collectionId, ownerId);
  } finally {
    unmarkDeleting(signalId);
  }
}

// Callers that already previewed the new order (pointer drag) must pass their pre-drag order.
export async function applyReorder(
  nextOrder: readonly ApiSignal[],
  rollbackTo: readonly ApiSignal[] | null = signals.value,
): Promise<void> {
  const ownerId = activeSnapshotOwnerId.value;
  const collectionId = activeCollectionId.value;
  signals.value = [...nextOrder];
  try {
    await reorderSignalsApi(
      nextOrder.map((item) => item.id),
      collectionId ?? undefined,
    );
    if (isActiveScope(ownerId, collectionId)) await loadSignals(collectionId, ownerId);
  } catch (err) {
    if (!isActiveScope(ownerId, collectionId)) return;
    signals.value = rollbackTo === null ? null : [...rollbackTo];
    fetchError.value = err instanceof Error ? err.message : 'Could not save the new order.';
  }
}
