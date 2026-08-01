import type { Adapter, AdapterResult } from './types';

type ManualConfig = { value: number | string; unit?: string; label?: string };

// This no-network adapter keeps manual values on the standard connector contract.
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
