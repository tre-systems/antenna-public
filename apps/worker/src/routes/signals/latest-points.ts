import { safeExternalUrl } from '@antenna/registry';
import { sql } from 'drizzle-orm';
import { parseStringRecord } from '../../db/codecs';
import { POINT_LIMIT } from './constants';
import type { Client, PointShape } from './types';

type RawPointRow = {
  readonly signal_id: string;
  readonly fetched_at: number;
  readonly observed_at: number;
  readonly metric_key: string;
  readonly dimensions: string | null;
  readonly value: number | null;
  readonly value_text: string | null;
  readonly unit: string | null;
  readonly source_url: string | null;
};

export const latestPointsForSignals = async (
  client: Client,
  signalIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, ReadonlyArray<PointShape>>> => {
  if (signalIds.length === 0) return new Map();

  const rows = await loadLatestPointRows(client, signalIds);
  return groupLatestPoints(rows);
};

const loadLatestPointRows = async (
  client: Client,
  signalIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<RawPointRow>> => {
  const wantedRows = sql.join(
    signalIds.map((id) => sql`(${id})`),
    sql`, `,
  );
  // VALUES avoids SQLite's UNION limit while bounding rows per signal.
  return await client.all(sql`
    WITH wanted(signal_id) AS (VALUES ${wantedRows})
    SELECT p.signal_id, p.fetched_at, p.observed_at, p.metric_key, p.dimensions, p.value, p.value_text, p.unit, p.source_url
    FROM wanted
    INNER JOIN signal_points AS p ON p.rowid IN (
      SELECT rowid
      FROM signal_points AS latest
      WHERE latest.signal_id = wanted.signal_id
        AND latest.fetched_at = (
          SELECT MAX(snapshot.fetched_at)
          FROM signal_points AS snapshot
          WHERE snapshot.signal_id = wanted.signal_id
        )
      ORDER BY latest.fetched_at DESC, latest.observed_at DESC, latest.metric_key ASC
      LIMIT ${POINT_LIMIT}
    )
    ORDER BY p.signal_id, p.fetched_at DESC, p.observed_at DESC, p.metric_key ASC
  `);
};

const groupLatestPoints = (
  rows: ReadonlyArray<RawPointRow>,
): ReadonlyMap<string, ReadonlyArray<PointShape>> => {
  const bySignal = new Map<string, PointShape[]>();
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    appendUniquePoint(bySignal, seen, row);
  }
  return bySignal;
};

const appendUniquePoint = (
  bySignal: Map<string, PointShape[]>,
  seen: Map<string, Set<string>>,
  row: RawPointRow,
): void => {
  const signalSeen = getSeenSet(seen, row.signal_id);
  const shape = pointShapeFromRawRow(row);
  const sig = `${shape.metric_key}|${JSON.stringify(shape.dimensions ?? {})}`;
  if (signalSeen.has(sig)) return;
  signalSeen.add(sig);
  getPointList(bySignal, row.signal_id).push(shape);
};

const getSeenSet = (seen: Map<string, Set<string>>, signalId: string): Set<string> => {
  const signalSeen = seen.get(signalId) ?? new Set<string>();
  if (!seen.has(signalId)) seen.set(signalId, signalSeen);
  return signalSeen;
};

const getPointList = (bySignal: Map<string, PointShape[]>, signalId: string): PointShape[] => {
  const points = bySignal.get(signalId) ?? [];
  if (!bySignal.has(signalId)) bySignal.set(signalId, points);
  return points;
};

const pointShapeFromRawRow = (row: RawPointRow): PointShape => ({
  observed_at: row.observed_at,
  fetched_at: row.fetched_at,
  metric_key: row.metric_key,
  dimensions: parseStringRecord(row.dimensions),
  value: row.value,
  value_text: row.value_text,
  unit: row.unit,
  source_url: safeExternalUrl(row.source_url),
  display: { label: '', source_url: null },
});
