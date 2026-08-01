import type { DataPoint } from '@antenna/connectors';
import type { signalPoints } from '../db/schema';

const normaliseDimensions = (
  dims: Readonly<Record<string, string | number>>,
): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dims)) out[k] = String(v);
  return out;
};

// Use metric_key to distinguish points sharing a signal and timestamp.
export const metricKeyFor = (point: DataPoint): string => {
  const keys = Object.keys(point.dimensions).sort();
  if (keys.length === 0) return 'value';
  return keys.map((k) => `${k}=${String(point.dimensions[k])}`).join('|');
};

export const toPointRow = (
  signalId: string,
  point: DataPoint,
  fetchedAt: number,
  rawPayloadId: string | null,
): typeof signalPoints.$inferInsert => {
  // Stringify dimensions because Drizzle's $type does not serialize text columns.
  const dimensions = JSON.stringify(normaliseDimensions(point.dimensions)) as unknown as Readonly<
    Record<string, string>
  >;
  const numeric = typeof point.value === 'number' ? point.value : null;
  const textual = typeof point.value === 'string' ? point.value : null;
  const observedAt = Number.isFinite(point.ts) ? point.ts : fetchedAt;
  return {
    signalId,
    fetchedAt: new Date(fetchedAt),
    observedAt: new Date(observedAt),
    metricKey: metricKeyFor(point),
    dimensions,
    value: numeric,
    valueText: textual,
    unit: point.unit ?? null,
    sourceUrl: point.sourceUrl ?? null,
    rawPayloadId,
  };
};
