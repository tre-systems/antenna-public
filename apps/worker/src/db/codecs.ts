export const parseJsonRecord = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
};

export const parseStringRecord = (raw: unknown): Record<string, string> | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') return JSON.parse(raw) as Record<string, string>;
  if (typeof raw === 'object') return raw as Record<string, string>;
  return null;
};

export const toTimestampMs = (value: Date | number | null): number | null => {
  if (value === null) return null;
  return value instanceof Date ? value.getTime() : value;
};
