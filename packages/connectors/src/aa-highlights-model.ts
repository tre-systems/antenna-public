export type AaCategory = 'intelligence' | 'speed' | 'price';

export type JsonLdDataset = {
  '@type': 'Dataset';
  name: string;
  data: Array<Record<string, unknown>>;
};

export const SOURCE_URL = 'https://artificialanalysis.ai';

// Category → JSON-LD Dataset names on the AA homepage, in order of preference.
export const CATEGORY_DATASET_NAMES: Record<AaCategory, readonly string[]> = {
  intelligence: ['Intelligence', 'Artificial Analysis Intelligence Index'],
  speed: ['Speed', 'Output Speed'],
  price: ['Price', 'Pricing: Cache Hit, Input, and Output'],
};

// Accept reviewed AA field aliases so upstream renames do not blank the cards.
export const CATEGORY_VALUE_KEYS: Record<AaCategory, readonly string[]> = {
  intelligence: ['artificialAnalysisIntelligenceIndex', 'intelligenceIndex'],
  speed: ['medianOutputSpeed', 'outputSpeed', 'speed'],
  price: ['pricePerMillionTokens', 'outputPrice', 'price', 'pricing.outputPrice'],
};

export const CATEGORY_UNIT: Record<AaCategory, string> = {
  intelligence: '',
  speed: 'tok/s',
  price: '$/M',
};

export const METRIC_NAME: Record<AaCategory, string> = {
  intelligence: 'aa_intelligence',
  speed: 'aa_speed',
  price: 'aa_price',
};

export const extractDataset = (html: string, names: readonly string[]): JsonLdDataset | null => {
  const acceptedNames = new Set(names);
  const scriptRx = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = scriptRx.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw.trim()) as Record<string, unknown>;
      if (
        obj['@type'] === 'Dataset' &&
        typeof obj['name'] === 'string' &&
        acceptedNames.has(obj['name']) &&
        Array.isArray(obj['data'])
      ) {
        return obj as unknown as JsonLdDataset;
      }
    } catch {
      // skip malformed blocks
    }
  }
  return null;
};

export const valuesByModel = (
  dataset: JsonLdDataset | null,
  keys: readonly string[],
): Map<string, number> => {
  const values = new Map<string, number>();
  for (const item of dataset?.data ?? []) {
    const model = itemLabel(item);
    const value = firstNumericField(item, keys);
    if (model && value !== null) values.set(normaliseModel(model), value);
  }
  return values;
};

export const itemLabel = (item: Record<string, unknown>): string | null =>
  typeof item['label'] === 'string' && item['label'].trim().length > 0
    ? item['label'].trim()
    : null;

export const normaliseModel = (model: string): string => model.trim().toLocaleLowerCase();

export const detailsUrl = (item: Record<string, unknown>): string =>
  typeof item['detailsUrl'] === 'string' && item['detailsUrl']
    ? `${SOURCE_URL}${item['detailsUrl']}`
    : SOURCE_URL;

export const firstNumericField = (
  item: Record<string, unknown>,
  keys: readonly string[],
): number | null => {
  for (const key of keys) {
    if (key.includes('.')) {
      const [field, propertyName] = key.split('.', 2);
      const values = typeof field === 'string' ? item[field] : undefined;
      const nested = numericPropertyValue(values, propertyName);
      if (nested !== null) return nested;
      continue;
    }
    const raw = item[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  }
  return null;
};

const numericPropertyValue = (raw: unknown, propertyName: string | undefined): number | null => {
  if (!propertyName || !Array.isArray(raw)) return null;
  const match = raw.find(
    (entry): entry is { readonly name: string; readonly value: number } =>
      typeof entry === 'object' &&
      entry !== null &&
      'name' in entry &&
      'value' in entry &&
      (entry as { readonly name?: unknown }).name === propertyName &&
      typeof (entry as { readonly value?: unknown }).value === 'number' &&
      Number.isFinite((entry as { readonly value: number }).value),
  );
  return match?.value ?? null;
};
