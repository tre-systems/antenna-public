import type { AdapterResult, DataPoint } from '@antenna/connectors';
import { sourcePolicyForTemplate } from '@antenna/registry';
import { eq, lt } from 'drizzle-orm';
import { upstreamSnapshots } from '../../db/schema';
import { toTimestampMs } from '../../db/codecs';
import type { Client, DispatchTemplate, SignalRow } from './types';

// How stale a shared snapshot may be, as a fraction of the asking signal's own
// refresh interval. Half an interval keeps every signal comfortably inside the
// freshness it promises, while collapsing N users drifting across an interval
// down to about two upstream fetches per interval instead of N.
const MAX_AGE_FRACTION = 0.5;

// Snapshots outlive their usefulness quickly; this only exists so rows for
// configs nobody tracks any more do not accumulate.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

// Sharing one user's fetch with another is only safe when the result cannot
// depend on who asked. Public-cloud sources qualify: no per-user credentials,
// no owner-scoped data, output determined by config alone. Private-cloud
// templates — manual values, deployment metrics, user-supplied endpoints — are
// never shared, whatever their config looks like.
//
// Templates that archive their raw payload are also excluded: a shared
// snapshot carries points only, so reusing one would leave a hole in the
// archive.
export const isShareableTemplate = (template: DispatchTemplate): boolean => {
  if (template.retainRawPayload === true) return false;
  return sourcePolicyForTemplate(template.id)?.executionMode === 'public_cloud';
};

// Identifies the exact upstream call. Built from the signal's stored config,
// not the prepared one, so server secrets never reach the key. Config values
// are canonicalised so key order cannot split one call into two cache entries.
export const snapshotCacheKey = (templateId: string, config: unknown): string =>
  `${templateId}|${canonicalJson(config)}`;

const canonicalJson = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`);
  return `{${entries.join(',')}}`;
};

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

// A cached row is data we wrote, but it round-trips through JSON text, so treat
// anything unreadable as a miss rather than letting it reach an adapter result.
const parsePoints = (raw: string): ReadonlyArray<DataPoint> | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReadonlyArray<DataPoint>) : null;
  } catch {
    return null;
  }
};

export const sharedSnapshotResult = (points: ReadonlyArray<DataPoint>): AdapterResult => ({
  ok: true,
  points: [...points],
  rawPayload: { source: 'shared-snapshot' },
});
