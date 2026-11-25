import type { DataPoint } from '../api';
import type { RenderSignal } from './types';
import { snapshotDate, snapshotLabel } from '../manual-snapshot';

export type CostSourcePosture = 'official' | 'estimated' | 'manual' | 'setup_required';

export type CostCardData = {
  readonly headline: {
    readonly formattedAmount: string;
    readonly periodLabel: string;
    readonly label: string;
  };
  readonly posture: CostSourcePosture;
  readonly breakdown: ReadonlyArray<{
    readonly label: string;
    readonly formattedAmount: string;
    readonly note: string;
  }>;
};

export function costCardData(signal: RenderSignal): CostCardData | null {
  const costPoints = signal.points.filter(isCostPoint);
  if (costPoints.length === 0) return null;
  const point =
    costPoints.find((candidate) => candidate.dimensions?.period === 'month_to_date') ??
    costPoints[0];
  if (!point || typeof point.value !== 'number' || !Number.isFinite(point.value)) return null;
  const dimensions = point.dimensions ?? {};
  const billingBreakdown = fixedFeeBreakdown(signal.points, point.unit ?? 'USD');
  const breakdown = billingBreakdown ?? costBreakdown(signal.points, periodLabel(point));
  return {
    headline: {
      formattedAmount: formatCurrency(point.value, point.unit ?? 'USD'),
      periodLabel: billingBreakdown ? 'current billing period' : periodLabel(point),
      label: billingBreakdown
        ? 'Fees + usage (pre-tax)'
        : breakdown.length > 0
          ? 'Usage cost'
          : 'Cost',
    },
    posture: postureOf(dimensions.posture),
    breakdown,
  };
}

function fixedFeeBreakdown(
  points: ReadonlyArray<DataPoint>,
  currency: string,
): CostCardData['breakdown'] | null {
  const fees = points.find((point) => point.dimensions?.metric === 'fixed_subscription_fees');
  const usage = points.find((point) => point.dimensions?.metric === 'usage_overages');
  if (!fees && !usage) return null;
  return [
    {
      label: 'Fixed subscription fees',
      formattedAmount: billingAmount(fees, currency),
      note: 'Current billing period',
    },
    {
      label: 'Usage overages',
      formattedAmount: billingAmount(usage, currency),
      note: 'Current billing period',
    },
  ];
}

function billingAmount(point: DataPoint | undefined, currency: string): string {
  return point?.unit === currency ? optionalAmount(point) : 'Not recorded';
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
}

function isCostPoint(point: DataPoint): boolean {
  const dimensions = point.dimensions ?? {};
  return dimensions.metric === 'cost' || (dimensions.family === 'cost' && !dimensions.metric);
}

function periodLabel(point: DataPoint): string {
  const month = point.dimensions?.period_month;
  if (typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${month}-01T00:00:00Z`));
  }
  const period = point.dimensions?.period;
  return (typeof period === 'string' ? period : 'month_to_date').replaceAll('_', ' ');
}

function costBreakdown(
  points: ReadonlyArray<DataPoint>,
  period: string,
): CostCardData['breakdown'] {
  const topUp = points.find((point) => point.dimensions?.metric === 'prepaid_top_up');
  const balance = points.find((point) => point.dimensions?.metric === 'credit_balance');
  if (!topUp && !balance) return [];
  return [
    { label: 'Prepaid top-ups', formattedAmount: optionalAmount(topUp), note: period },
    {
      label: 'Remaining credit',
      formattedAmount: optionalAmount(balance),
      note: snapshotLabel(snapshotDate(balance?.dimensions?.as_of)),
    },
  ];
}

function optionalAmount(point: DataPoint | undefined): string {
  return typeof point?.value === 'number' && Number.isFinite(point.value)
    ? formatCurrency(point.value, point.unit ?? 'USD')
    : 'Not recorded';
}

function postureOf(value: unknown): CostSourcePosture {
  if (value === 'official' || value === 'estimated' || value === 'setup_required') return value;
  return 'manual';
}
