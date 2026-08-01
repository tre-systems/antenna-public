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
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.signals) &&
    value.signals.every(isApiSignal) &&
    isFiniteNumber(value.fetchedAt)
  );
};

const isApiSignal = (value: unknown): value is ApiSignal => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.template_id === 'string' &&
    optionalString(value.title) &&
    isVisibility(value.visibility) &&
    isRecord(value.config) &&
    isFiniteNumber(value.refresh_seconds) &&
    isStatus(value.status) &&
    Array.isArray(value.points) &&
    value.points.every(isPoint) &&
    optionalSignalDisplay(value.display) &&
    optionalSourcePolicy(value.source_policy)
  );
};

const isStatus = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return (
    isSignalStatus(value.status) &&
    nullableNumber(value.last_ok_at) &&
    nullableNumber(value.last_attempt_at) &&
    (value.last_error === null || typeof value.last_error === 'string') &&
    nullableNumber(value.last_manual_request_at)
  );
};

const isPoint = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const dimensions = value.dimensions;
  const pointValue = value.value;
  return (
    (dimensions === null ||
      (isRecord(dimensions) && Object.values(dimensions).every(isDimension))) &&
    (pointValue === null || isFiniteNumber(pointValue) || typeof pointValue === 'string') &&
    optionalNullableString(value.value_text) &&
    optionalNullableString(value.unit) &&
    optionalNullableString(value.source_url) &&
    optionalFiniteNumber(value.ts) &&
    optionalFiniteNumber(value.observed_at) &&
    optionalFiniteNumber(value.fetched_at) &&
    optionalPointDisplay(value.display)
  );
};

const optionalSignalDisplay = (value: unknown): boolean =>
  value === undefined ||
  (isRecord(value) &&
    typeof value.title === 'string' &&
    typeof value.source_label === 'string' &&
    (value.source_url === null || typeof value.source_url === 'string'));

const optionalPointDisplay = (value: unknown): boolean =>
  value === undefined ||
  (isRecord(value) &&
    typeof value.label === 'string' &&
    (value.source_url === null || typeof value.source_url === 'string'));

const optionalSourcePolicy = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (isRecord(value) &&
    typeof value.source_id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.source_url === 'string' &&
    isRightsStatus(value.rights_status) &&
    isExecutionMode(value.execution_mode) &&
    typeof value.public_display_eligible === 'boolean' &&
    (value.public_display_blocker === null || typeof value.public_display_blocker === 'string') &&
    typeof value.attribution === 'string' &&
    typeof value.last_reviewed === 'string');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const nullableNumber = (value: unknown): boolean => value === null || isFiniteNumber(value);
const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';
const optionalNullableString = (value: unknown): boolean =>
  value === undefined || value === null || typeof value === 'string';
const optionalFiniteNumber = (value: unknown): boolean =>
  value === undefined || isFiniteNumber(value);
const isDimension = (value: unknown): boolean =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const isVisibility = (value: unknown): boolean =>
  value === 'private' || value === 'shared' || value === 'public';
const isSignalStatus = (value: unknown): boolean =>
  value === null ||
  value === 'live' ||
  value === 'stale' ||
  value === 'error' ||
  value === 'loading';
const isRightsStatus = (value: unknown): boolean =>
  value === 'public' ||
  value === 'with-attribution' ||
  value === 'requires-auth' ||
  value === 'needs-review';
const isExecutionMode = (value: unknown): boolean =>
  value === 'public_cloud' || value === 'private_cloud' || value === 'user_side_runner';
