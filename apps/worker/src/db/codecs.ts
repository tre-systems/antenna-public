export const parseJsonRecord = (raw: unknown): Record<string, unknown> => {
  const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return isRecord(value) ? value : {};
};

export const parseStringRecord = (raw: unknown): Record<string, string> | null => {
  if (raw === null || raw === undefined) return null;
  const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!isRecord(value)) return null;

  const entries = Object.entries(value);
  if (!entries.every(([, entry]) => typeof entry === 'string' || typeof entry === 'number')) {
    return null;
  }
  return Object.fromEntries(entries.map(([key, entry]) => [key, String(entry)]));
};

export const canonicalJson = (value: unknown): string => {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError('Value is not JSON serializable');
  }
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
  return `{${entries.join(',')}}`;
};

export const toTimestampMs = (value: Date | number | null): number | null => {
  if (value === null) return null;
  return value instanceof Date ? value.getTime() : value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
