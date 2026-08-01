import type { DataPoint } from '@antenna/connectors';
import { eq } from 'drizzle-orm';
import { signalStatus } from '../../db/schema';
import { metricKeyFor } from '../point-row';
import { toTimestampMs } from '../../db/codecs';
import type { Client, StatusRow } from './types';

const CHECKPOINT_MS = 24 * 60 * 60 * 1000;

type SnapshotDecision = {
  readonly hash: string;
  readonly changed: boolean;
  readonly persist: boolean;
};

export const snapshotDecision = async (
  points: ReadonlyArray<DataPoint>,
  previous: StatusRow | undefined,
  now: number,
): Promise<SnapshotDecision> => {
  const hash = await snapshotHash(points);
  const changed = previous?.lastDataHash !== hash;
  const lastDataAt = toTimestampMs(previous?.lastDataAt ?? null);
  return {
    hash,
    changed,
    persist: changed || lastDataAt === null || now - lastDataAt >= CHECKPOINT_MS,
  };
};

export const recordSnapshotState = async (
  client: Client,
  signalId: string,
  hash: string,
  now: number,
): Promise<void> => {
  await client
    .update(signalStatus)
    .set({ lastDataHash: hash, lastDataAt: new Date(now) })
    .where(eq(signalStatus.signalId, signalId))
    .run();
};

// Sort dimensions and rows so source ordering cannot change the fingerprint.
const snapshotHash = async (points: ReadonlyArray<DataPoint>): Promise<string> => {
  const canonical = points
    .map((point) => ({
      metric: metricKeyFor(point),
      dimensions: Object.fromEntries(
        Object.entries(point.dimensions)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => [key, String(value)]),
      ),
      value: point.value,
      unit: point.unit ?? null,
      sourceUrl: point.sourceUrl ?? null,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
