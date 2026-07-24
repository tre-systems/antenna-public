import type { Adapter, AdapterResult, DataPoint } from './types';

export type AaHighlightsConfig = {
  readonly category: 'intelligence' | 'speed' | 'price';
  readonly limit?: number;
};

export type AaFrontierConfig = {
  readonly limit?: number;
};

const SOURCE_URL = 'https://artificialanalysis.ai';
const DEFAULT_LIMIT = 5;

// Category → JSON-LD Dataset names on the AA homepage, in order of preference.
const CATEGORY_DATASET_NAMES: Record<AaHighlightsConfig['category'], readonly string[]> = {
  intelligence: ['Intelligence', 'Artificial Analysis Intelligence Index'],
  speed: ['Speed', 'Output Speed'],
  price: ['Price', 'Pricing: Cache Hit, Input, and Output'],
};

// Category → value keys in each data item, in order of preference. AA has
// already renamed fields on the homepage JSON-LD; accept the reviewed aliases
// we have seen so a small wording/key change does not blank the cards.
const CATEGORY_VALUE_KEYS: Record<AaHighlightsConfig['category'], readonly string[]> = {
  intelligence: ['artificialAnalysisIntelligenceIndex', 'intelligenceIndex'],
  speed: ['medianOutputSpeed', 'outputSpeed', 'speed'],
  price: ['pricePerMillionTokens', 'outputPrice', 'price', 'pricing.outputPrice'],
};

const CATEGORY_UNIT: Record<AaHighlightsConfig['category'], string> = {
  intelligence: '',
  speed: 'tok/s',
  price: '$/M',
};

const METRIC_NAME: Record<AaHighlightsConfig['category'], string> = {
  intelligence: 'aa_intelligence',
  speed: 'aa_speed',
  price: 'aa_price',
};

type JsonLdDataset = {
  '@type': 'Dataset';
  name: string;
  data: Array<Record<string, unknown>>;
};

export const aaHighlights: Adapter<AaHighlightsConfig> = async (config): Promise<AdapterResult> => {
  const category = config.category;
  const limit = typeof config.limit === 'number' && config.limit > 0 ? config.limit : DEFAULT_LIMIT;

  const page = await fetchAaPage();
  if (!page.ok) return page;
  const html = page.html;

  const datasetNames = CATEGORY_DATASET_NAMES[category];
  const dataset = extractDataset(html, datasetNames);
  if (!dataset) {
    return {
      ok: false,
      error: {
        code: 'parse_failed',
        message: `none of "${datasetNames.join('", "')}" datasets found in page`,
      },
    };
  }

  const valueKeys = CATEGORY_VALUE_KEYS[category];
  const unit = CATEGORY_UNIT[category];
  const metric = METRIC_NAME[category];
  const now = Date.now();
  const points: DataPoint[] = [];

  for (const [idx, item] of dataset.data.slice(0, limit).entries()) {
    const label = typeof item['label'] === 'string' ? item['label'].trim() : null;
    const value = firstNumericField(item, valueKeys);
    if (!label || value === null || !Number.isFinite(value)) continue;

    const relativeUrl = typeof item['detailsUrl'] === 'string' ? item['detailsUrl'] : '';
    const sourceUrl = relativeUrl ? `${SOURCE_URL}${relativeUrl}` : SOURCE_URL;

    points.push({
      dimensions: { metric, rank: idx + 1, model: label },
      value,
      unit,
      ts: now,
      sourceUrl,
    });
  }

  if (points.length === 0) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: `no valid entries in "${dataset.name}" dataset` },
    };
  }

  return { ok: true, points, rawPayload: { category, dataset } };
};

export const aaFrontier: Adapter<AaFrontierConfig> = async (config): Promise<AdapterResult> => {
  const limit = typeof config.limit === 'number' && config.limit > 0 ? config.limit : DEFAULT_LIMIT;
  const page = await fetchAaPage();
  if (!page.ok) return page;

  const intelligence = extractDataset(page.html, CATEGORY_DATASET_NAMES.intelligence);
  const speed = extractDataset(page.html, CATEGORY_DATASET_NAMES.speed);
  const price = extractDataset(page.html, CATEGORY_DATASET_NAMES.price);
  if (!intelligence) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: 'intelligence dataset not found in page' },
    };
  }

  const speedByModel = valuesByModel(speed, CATEGORY_VALUE_KEYS.speed);
  const priceByModel = valuesByModel(price, CATEGORY_VALUE_KEYS.price);
  const now = Date.now();
  const points: DataPoint[] = [];

  for (const [index, item] of intelligence.data.slice(0, limit).entries()) {
    const model = itemLabel(item);
    const score = firstNumericField(item, CATEGORY_VALUE_KEYS.intelligence);
    if (!model || score === null) continue;
    const key = normaliseModel(model);
    const relativeUrl = typeof item['detailsUrl'] === 'string' ? item['detailsUrl'] : '';
    points.push({
      dimensions: {
        metric: 'aa_frontier',
        rank: index + 1,
        model,
        speed: speedByModel.get(key) ?? '',
        price: priceByModel.get(key) ?? '',
      },
      value: score,
      unit: 'index',
      ts: now,
      sourceUrl: relativeUrl ? `${SOURCE_URL}${relativeUrl}` : SOURCE_URL,
    });
  }

  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no frontier model entries' } };
  }
  return {
    ok: true,
    points,
    rawPayload: {
      intelligence: intelligence.name,
      speed: speed?.name ?? null,
      price: price?.name ?? null,
    },
  };
};

const fetchAaPage = async (): Promise<
  { readonly ok: true; readonly html: string } | Extract<AdapterResult, { ok: false }>
> => {
  let response: Response;
  try {
    response = await fetch(SOURCE_URL, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'fetch_failed',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: `HTTP ${String(response.status)}` },
    };
  }
  try {
    return { ok: true, html: await response.text() };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'parse_failed',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
};

const valuesByModel = (
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

const itemLabel = (item: Record<string, unknown>): string | null =>
  typeof item['label'] === 'string' && item['label'].trim().length > 0
    ? item['label'].trim()
    : null;

const normaliseModel = (model: string): string => model.trim().toLocaleLowerCase();

const firstNumericField = (
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

const extractDataset = (html: string, names: readonly string[]): JsonLdDataset | null => {
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
      // skip malformed signals
    }
  }
  return null;
};
