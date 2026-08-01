import { manual } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// Explicit selection is primary; prompt matches leave value for user confirmation.
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
