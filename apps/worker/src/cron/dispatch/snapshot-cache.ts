import type { AdapterResult, DataPoint } from '@antenna/connectors';
import { sourcePolicyForTemplate } from '@antenna/registry';
import { eq, lt } from 'drizzle-orm';
import { upstreamSnapshots } from '../../db/schema';
import { canonicalJson, toTimestampMs } from '../../db/codecs';
import type { Client, DispatchTemplate, SignalRow } from './types';

// Half an interval preserves freshness while collapsing duplicate upstream calls.
const MAX_AGE_FRACTION = 0.5;

// Purge abandoned cache rows after this interval.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

// Only config-determined public results without raw archives may cross owners.
export const isShareableTemplate = (template: DispatchTemplate): boolean => {
  if (template.retainRawPayload === true) return false;
  return sourcePolicyForTemplate(template.id)?.executionMode === 'public_cloud';
};

// Canonicalise stored config so injected secrets never enter cache keys.
export const snapshotCacheKey = (
  templateId: string,
  config: unknown,
  snapshotVersion = 1,
): string => `${templateId}@${String(snapshotVersion)}|${canonicalJson(config)}`;

export const maxSnapshotAgeMs = (signal: SignalRow): number =>
  Math.floor(signal.refreshSeconds * 1000 * MAX_AGE_FRACTION);

export const readSharedSnapshot = async (
  client: Client,
  cacheKey: string,
  maxAgeMs: number,
  now: number,
): Promise<ReadonlyArray<DataPoint> | null> => {
  const [row] = await client
    .select()
    .from(upstreamSnapshots)
    .where(eq(upstreamSnapshots.cacheKey, cacheKey))
    .limit(1)
    .all();
  if (!row) return null;

  const fetchedAt = toTimestampMs(row.fetchedAt);
  if (fetchedAt === null || now - fetchedAt > maxAgeMs) return null;
  return parsePoints(row.points);
};

export const writeSharedSnapshot = async (
  client: Client,
  cacheKey: string,
  templateId: string,
  points: ReadonlyArray<DataPoint>,
  now: number,
): Promise<void> => {
  const values = {
    cacheKey,
    templateId,
    points: JSON.stringify(points),
    fetchedAt: new Date(now),
  };
  await client
    .insert(upstreamSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: upstreamSnapshots.cacheKey,
      set: { points: values.points, fetchedAt: values.fetchedAt, templateId },
    })
    .run();
};

export const purgeExpiredSnapshots = async (
  client: Client,
  now: number = Date.now(),
): Promise<void> => {
  await client
    .delete(upstreamSnapshots)
    .where(lt(upstreamSnapshots.fetchedAt, new Date(now - SNAPSHOT_TTL_MS)))
    .run();
};

// Treat malformed persisted points as a cache miss.
const parsePoints = (raw: string): ReadonlyArray<DataPoint> | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isDataPoint) ? parsed : null;
  } catch {
    return null;
  }
};

const isDataPoint = (value: unknown): value is DataPoint => {
  if (!isRecord(value) || !isDimensions(value.dimensions)) return false;
  if (typeof value.ts !== 'number' || !Number.isFinite(value.ts)) return false;
  if (
    typeof value.value !== 'string' &&
    (typeof value.value !== 'number' || !Number.isFinite(value.value))
  ) {
    return false;
  }
  return optionalString(value.unit) && optionalString(value.sourceUrl);
};

const isDimensions = (value: unknown): value is DataPoint['dimensions'] =>
  isRecord(value) &&
  Object.values(value).every(
    (entry) => typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry)),
  );

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const sharedSnapshotResult = (points: ReadonlyArray<DataPoint>): AdapterResult => ({
  ok: true,
  points: [...points],
  rawPayload: { source: 'shared-snapshot' },
});
