export const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export const dimensionValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

export const splitList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const stripQuote = (pair: string): string => pair.replace(/-USD$/, '');

export const stripExchange = (ticker: string): string => ticker.replace(/\.[A-Z]{1,3}$/, '');

export const titleCase = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

// Preserves the rest of a project slug ("swade-toolbox" → "Swade-toolbox").
export const capitaliseFirst = (value: string): string =>
  value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
