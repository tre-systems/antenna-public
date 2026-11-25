import {
  CATEGORY_DATASET_NAMES,
  CATEGORY_UNIT,
  CATEGORY_VALUE_KEYS,
  detailsUrl,
  firstNumericField,
  itemLabel,
  METRIC_NAME,
  normaliseModel,
  SOURCE_URL,
  valuesByModel,
  type AaCategory,
} from './aa-highlights-model';
import { extractAaDatasets } from './aa-homepage-data';
import { HTML_PAGE_REQUEST_INIT } from './browser-request';
import { boundedInt } from './config-values';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult, DataPoint } from './types';

export type AaHighlightsConfig = {
  readonly category: AaCategory;
  readonly limit?: number;
};

export type AaFrontierConfig = {
  readonly limit?: number;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

export const aaHighlights: Adapter<AaHighlightsConfig> = async (config): Promise<AdapterResult> => {
  const category = config.category;
  const limit = entryLimit(config.limit);

  const page = await fetchAaPage();
  if (!page.ok) return page;

  const datasetNames = CATEGORY_DATASET_NAMES[category];
  const dataset = extractAaDatasets(page.html)[category];
  if (!dataset) {
    return {
      ok: false,
      error: {
        code: 'parse_failed',
        message: `none of "${datasetNames.join('", "')}" datasets found in page`,
      },
    };
  }

  const now = Date.now();
  const points: DataPoint[] = [];
  for (const [index, item] of dataset.data.slice(0, limit).entries()) {
    const label = itemLabel(item);
    const value = firstNumericField(item, CATEGORY_VALUE_KEYS[category]);
    if (!label || value === null) continue;
    points.push({
      dimensions: { metric: METRIC_NAME[category], rank: index + 1, model: label },
      value,
      unit: CATEGORY_UNIT[category],
      ts: now,
      sourceUrl: detailsUrl(item),
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
  const limit = entryLimit(config.limit);
  const page = await fetchAaPage();
  if (!page.ok) return page;

  const { intelligence, speed, price } = extractAaDatasets(page.html);
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
      sourceUrl: detailsUrl(item),
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

const entryLimit = (limit: number | undefined): number =>
  boundedInt(limit, DEFAULT_LIMIT, 1, MAX_LIMIT);

const fetchAaPage = async (): Promise<
  { readonly ok: true; readonly html: string } | Extract<AdapterResult, { ok: false }>
> => {
  let response: Response;
  try {
    // The comparison page retains output-token prices; the homepage now shows cost per task.
    response = await fetch(`${SOURCE_URL}/models`, HTML_PAGE_REQUEST_INIT);
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }
  if (!response.ok) {
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'fetch_failed', message: `HTTP ${String(response.status)}` },
    };
  }
  try {
    return { ok: true, html: await response.text() };
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
};
