// Every failure mode collapses to `null` so callers can fall back to manual
// lat/lon entry uniformly.
export type GeocodeHit = {
  readonly lat: number;
  readonly lon: number;
  readonly resolvedName: string;
};

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === 'object' ? (value as Readonly<Record<string, unknown>>) : null;

const asArray = (value: unknown): ReadonlyArray<unknown> | null =>
  Array.isArray(value) ? (value as ReadonlyArray<unknown>) : null;

export const geocode = async (name: string): Promise<GeocodeHit | null> => {
  if (typeof name !== 'string' || name.trim().length === 0) return null;

  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(name.trim())}&count=1&language=en&format=json`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const bodyRecord = asRecord(body);
  if (!bodyRecord) return null;
  const results = asArray(bodyRecord.results);
  if (!results || results.length === 0) return null;

  const top = asRecord(results[0]);
  if (!top) return null;
  const lat = top.latitude;
  const lon = top.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const parts = [top.name, top.admin1, top.country]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim());
  if (parts.length === 0) return null;

  return { lat, lon, resolvedName: parts.join(', ') };
};
