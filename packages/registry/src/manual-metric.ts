import { manual } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// The matcher rarely fires for manual signals — they're chosen explicitly by the
// user. The planner marks `value` as missing and prompts for it.
type ManualTemplateConfig = { value?: number | string; unit?: string; label?: string };

export const manualMetricTemplate: ConnectorTemplate<ManualTemplateConfig> = {
  id: 'manual-metric',
  displayName: 'Manual metric',
  configSchema: z.object({
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    label: z.string().optional(),
  }),
  paramKeys: ['value', 'unit', 'label'] as const,
  matchHints: [/\bmanual\b/i, /\btrack\s+a\s+number\b/i],
  paramExtractors: {
    value: () => undefined,
    unit: () => undefined,
    label: () => undefined,
  },
  rightsStatus: 'public',
  defaultRefreshSeconds: 86400,
  adapter: async (config) => {
    if (typeof config.value !== 'number' && typeof config.value !== 'string') {
      return {
        ok: false,
        error: { code: 'parse_failed', message: 'manual metric requires a value' },
      };
    }
    return manual({ value: config.value, unit: config.unit, label: config.label });
  },
};
