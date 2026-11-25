import {
  CATEGORY_DATASET_NAMES,
  extractDataset,
  type AaCategory,
  type JsonLdDataset,
} from './aa-highlights-model';

type Model = Record<string, unknown>;
type Datasets = Record<AaCategory, JsonLdDataset | null>;
const categories: readonly AaCategory[] = ['intelligence', 'speed', 'price'];

export const extractAaDatasets = (html: string): Datasets => {
  const models = homepageModels(html);
  return Object.fromEntries(
    categories.map((category) => {
      const legacy = extractDataset(html, CATEGORY_DATASET_NAMES[category]);
      return [category, legacy?.data.length ? legacy : modelDataset(models, category)];
    }),
  ) as Datasets;
};

// Read JSON only: public chart props replace metadata-only JSON-LD.
const homepageModels = (html: string): Model[] => {
  const payload = flightChunks(html).join('');
  for (const line of payload.split('\n')) {
    const record = parseJson(line.slice(line.indexOf(':') + 1));
    const models = findInitialModels(record);
    if (models.length) return models;
  }
  return [];
};

const flightChunks = (html: string): string[] => {
  const chunks: string[] = [];
  const scripts = html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi);
  for (const [, body] of scripts) {
    const match = body?.trim().match(/^self\.__next_f\.push\((\[[\s\S]*\])\);?$/);
    const chunk = parseJson(match?.[1] ?? '');
    if (Array.isArray(chunk) && chunk[0] === 1 && typeof chunk[1] === 'string') {
      chunks.push(chunk[1]);
    }
  }
  return chunks;
};

const findInitialModels = (value: unknown, depth = 0): Model[] => {
  if (depth > 20) return [];
  const record = asRecord(value);
  for (const key of ['initialModels', 'initialData']) {
    const data = record?.[key];
    if (Array.isArray(data)) {
      const models = data.map(asRecord).filter(isModel);
      if (models.length) return models;
    }
  }
  const children = Array.isArray(value) ? value : record ? Object.values(record) : [];
  for (const child of children) {
    const models = findInitialModels(child, depth + 1);
    if (models.length) return models;
  }
  return [];
};

const isModel = (value: Model | null): value is Model =>
  value !== null &&
  typeof value['slug'] === 'string' &&
  /^[a-z0-9][a-z0-9-]*$/.test(value['slug']) &&
  value['deprecated'] !== true &&
  modelLabel(value) !== null &&
  categories.some((category) => modelValue(value, category) !== null);

const modelDataset = (models: Model[], category: AaCategory): JsonLdDataset | null => {
  const data = models.flatMap((model) => {
    const value = modelValue(model, category);
    return value === null
      ? []
      : [{ label: modelLabel(model), value, detailsUrl: `/models/${String(model['slug'])}` }];
  });
  data.sort((a, b) => (category === 'price' ? a.value - b.value : b.value - a.value));
  if (!data.length) return null;
  const key = {
    intelligence: 'intelligenceIndex',
    speed: 'medianOutputSpeed',
    price: 'outputPrice',
  }[category];
  return {
    '@type': 'Dataset',
    name: CATEGORY_DATASET_NAMES[category][0] ?? category,
    data: data.map(({ value, ...model }) => ({ ...model, [key]: value })),
  };
};

const modelLabel = (model: Model): string | null => {
  for (const key of ['shortName', 'name']) {
    const value = model[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const modelValue = (model: Model, category: AaCategory): number | null => {
  const value =
    category === 'intelligence'
      ? model['intelligenceIndex']
      : category === 'price'
        ? model['price1mOutputTokens']
        : (asRecord(model['headline'])?.['outputSpeed'] ??
          model['medianOutputSpeed'] ??
          asRecord(model['timescaleData'])?.['medianOutputSpeed']);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
};

const asRecord = (value: unknown): Model | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Model) : null;

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};
