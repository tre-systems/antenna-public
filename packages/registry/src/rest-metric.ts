import { restGeneric } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

const URL_RX = /https?:\/\/\S+/i;
const TRAILING_URL_PUNCTUATION = new Set([')', '.', ',', '!', '?']);

const extractUrl = (prompt: string): string | undefined => {
  const match = URL_RX.exec(prompt);
  const candidate = match?.[0];
  if (candidate === undefined) return undefined;

  let end = candidate.length;
  while (end > 0 && TRAILING_URL_PUNCTUATION.has(candidate[end - 1] ?? '')) end -= 1;
  return candidate.slice(0, end);
};

// The planner has to prompt for jsonPath; there's no reliable way to guess.
type RestTemplateConfig = { url: string; jsonPath?: string; label?: string; unit?: string };

export const restMetricTemplate: ConnectorTemplate<RestTemplateConfig> = {
  id: 'rest-metric',
  displayName: 'REST metric',
  configSchema: z.object({
    url: z.url(),
    jsonPath: z.string().min(1),
    label: z.string().optional(),
    unit: z.string().optional(),
  }),
  paramKeys: ['url', 'jsonPath', 'label', 'unit'] as const,
  matchHints: [/https?:\/\//i, /\bendpoint\b/i, /\bapi\b/i, /\brest\b/i],
  plannerEnabled: false,
  paramExtractors: {
    url: extractUrl,
    jsonPath: () => undefined,
    label: () => undefined,
    unit: () => undefined,
  },
  rightsStatus: 'needs-review',
  defaultRefreshSeconds: 1800,
  adapter: async (config) => {
    if (typeof config.jsonPath !== 'string' || config.jsonPath.length === 0) {
      return {
        ok: false,
        error: { code: 'parse_failed', message: 'rest-metric requires jsonPath' },
      };
    }
    return restGeneric({
      url: config.url,
      jsonPath: config.jsonPath,
      label: config.label,
      unit: config.unit,
    });
  },
};
