import type { Adapter, AdapterResult } from './types';

type ManualConfig = { value: number | string; unit?: string; label?: string };

// No network; the planner / UI is the source of the value. This adapter exists
// so the manual signal uses the same contract as the rest.
export const manual: Adapter<ManualConfig> = (config): Promise<AdapterResult> =>
  Promise.resolve({
    ok: true,
    points: [
      {
        dimensions: { label: config.label ?? 'value' },
        value: config.value,
        unit: config.unit,
        ts: Date.now(),
      },
    ],
    rawPayload: { source: 'manual' },
  });
