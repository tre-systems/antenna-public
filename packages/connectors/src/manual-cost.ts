import type { Adapter, AdapterResult } from './types';

export type ManualCostConfig = {
  amount: number | '';
  currency: string;
  period: string;
  provider: string;
  service?: string;
  project?: string;
};

export const manualCost: Adapter<ManualCostConfig> = (config): Promise<AdapterResult> => {
  if (config.amount === '') {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'unknown',
        message: 'setup_required: Enter the current amount in card settings.',
      },
    });
  }

  return Promise.resolve({
    ok: true,
    points: [
      {
        dimensions: {
          family: 'cost',
          metric: 'cost',
          period: config.period,
          posture: 'manual',
          provider: config.provider,
          service: config.service ?? 'All services',
          ...(config.project ? { project: config.project } : {}),
        },
        value: config.amount,
        unit: config.currency,
        ts: Date.now(),
      },
    ],
    rawPayload: { source: 'manual' },
  });
};
