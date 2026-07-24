import type { DataPoint } from '../api';
import type { RenderSignal } from './types';

export type CostSourcePosture = 'official' | 'estimated' | 'manual' | 'setup_required';

export type CostCardData = {
  readonly headline: {
    readonly formattedAmount: string;
    readonly periodLabel: string;
  };
  readonly posture: CostSourcePosture;
};

export function costCardData(signal: RenderSignal): CostCardData | null {
  const costPoints = signal.points.filter(isCostPoint);
  if (costPoints.length === 0) return null;
  const point =
    costPoints.find((candidate) => candidate.dimensions?.period === 'month_to_date') ??
    costPoints[0];
  if (!point || typeof point.value !== 'number' || !Number.isFinite(point.value)) return null;
  const dimensions = point.dimensions ?? {};
  const period = typeof dimensions.period === 'string' ? dimensions.period : 'month_to_date';
  return {
    headline: {
      formattedAmount: formatCurrency(point.value, point.unit ?? 'USD'),
      periodLabel: period.replaceAll('_', ' '),
    },
    posture: postureOf(dimensions.posture),
  };
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
}

function isCostPoint(point: DataPoint): boolean {
  const dimensions = point.dimensions ?? {};
  return dimensions.family === 'cost' || dimensions.metric === 'cost';
}

function postureOf(value: unknown): CostSourcePosture {
  if (value === 'official' || value === 'estimated' || value === 'setup_required') return value;
  return 'manual';
}
