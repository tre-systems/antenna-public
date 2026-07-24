import { fetchJson } from './fetch-json';
import { resolveJsonPath } from './json-path';
import type { Adapter, AdapterResult } from './types';

type RestConfig = { url: string; jsonPath: string; label?: string; unit?: string };

export const restGeneric: Adapter<RestConfig> = async (config): Promise<AdapterResult> => {
  const fetched = await fetchJson(config.url);
  if (!fetched.ok) return fetched;
  const body = fetched.body;

  const resolved = resolveJsonPath(body, config.jsonPath);
  if (typeof resolved !== 'number' && typeof resolved !== 'string') {
    return { ok: false, error: { code: 'parse_failed', message: 'jsonPath did not resolve' } };
  }

  return {
    ok: true,
    points: [
      {
        dimensions: { label: config.label ?? config.jsonPath },
        value: resolved,
        unit: config.unit,
        ts: Date.now(),
      },
    ],
    rawPayload: body,
  };
};
