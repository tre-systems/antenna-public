import type { Adapter, AdapterResult, DataPoint } from './types';

export type ManualCostConfig = {
  amount: number | '';
  currency: string;
  period: string;
  provider: string;
  service?: string;
  project?: string;
  topUps?: number;
  creditBalance?: number;
  asOf?: string;
  creditBalanceAsOf?: string;
  periodMonth?: string;
  fixedFees?: number;
  usageOverages?: number;
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
    points: costPoints(config, config.amount),
    rawPayload: { source: 'manual' },
  });
};

function costPoints(config: ManualCostConfig, amount: number): DataPoint[] {
  const points = [costPoint(config, 'cost', amount, config.asOf)];
  if (config.fixedFees !== undefined && config.usageOverages !== undefined) {
    points.push(costPoint(config, 'fixed_subscription_fees', config.fixedFees, config.asOf));
    points.push(costPoint(config, 'usage_overages', config.usageOverages, config.asOf));
  }
  if (config.topUps !== undefined) {
    points.push(costPoint(config, 'prepaid_top_up', config.topUps, config.asOf));
  }
  if (config.creditBalance !== undefined) {
    points.push(
      costPoint(config, 'credit_balance', config.creditBalance, config.creditBalanceAsOf),
    );
  }
  return points;
}

function costPoint(
  config: ManualCostConfig,
  metric: string,
  value: number,
  asOf: string | undefined,
): DataPoint {
  return {
    dimensions: {
      family: 'cost',
      metric,
      period: metric === 'credit_balance' ? 'balance' : config.period,
      posture: 'manual',
      provider: config.provider,
      service: config.service ?? 'All services',
      ...(config.project ? { project: config.project } : {}),
      ...(asOf ? { as_of: asOf } : {}),
      ...(config.periodMonth && metric !== 'credit_balance'
        ? { period_month: config.periodMonth }
        : {}),
    },
    value,
    unit: config.currency,
    ts: asOf ? Date.parse(asOf) : Date.now(),
  };
}
