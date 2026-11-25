import { describe, expect, it } from 'vitest';
import { costCardData, formatCurrency } from './cost';
import { makeSignal } from './test-support';
import type { DataPoint } from '../api';

describe('cost formatting', () => {
  it('shows a pre-tax total and separated fixed fees and overages regardless of point order', () => {
    const points: DataPoint[] = [
      { dimensions: { family: 'cost', metric: 'fixed_subscription_fees' }, value: 5, unit: 'USD' },
      { dimensions: { family: 'cost', metric: 'usage_overages' }, value: 0, unit: 'USD' },
      {
        dimensions: { family: 'cost', metric: 'cost', period: 'month_to_date' },
        value: 5,
        unit: 'USD',
      },
    ];
    const data = costCardData(makeSignal({ points }));
    expect(data?.headline).toEqual({
      label: 'Fees + usage (pre-tax)',
      formattedAmount: 'US$5.00',
      periodLabel: 'current billing period',
    });
    expect(data?.breakdown.map((item) => [item.label, item.formattedAmount])).toEqual([
      ['Fixed subscription fees', 'US$5.00'],
      ['Usage overages', 'US$0.00'],
    ]);
    expect(costCardData(makeSignal({ points: points.slice(0, 2) }))).toBeNull();
    const missing = costCardData(
      makeSignal({
        points: points.filter((point) => point.dimensions?.metric !== 'usage_overages'),
      }),
    );
    expect(missing?.breakdown[1]?.formattedAmount).toBe('Not recorded');
    const mixed = costCardData(
      makeSignal({
        points: points.map((point) =>
          point.dimensions?.metric === 'fixed_subscription_fees'
            ? { ...point, unit: 'GBP' }
            : point,
        ),
      }),
    );
    expect(mixed?.breakdown[0]?.formattedAmount).toBe('Not recorded');
  });

  it('never picks a top-up or balance as usage, even when those points appear first', () => {
    const points: DataPoint[] = [
      {
        dimensions: { family: 'cost', metric: 'prepaid_top_up', period: 'month_to_date' },
        value: 16,
        unit: 'GBP',
      },
      {
        dimensions: { family: 'cost', metric: 'credit_balance', as_of: '2026-10-31T07:00:00Z' },
        value: 12.5,
        unit: 'GBP',
      },
      {
        dimensions: {
          family: 'cost',
          metric: 'cost',
          period: 'month_to_date',
          period_month: '2026-10',
        },
        value: 2.004321,
        unit: 'GBP',
      },
    ];
    const data = costCardData(makeSignal({ points }));
    expect(data?.headline).toEqual({
      label: 'Usage cost',
      formattedAmount: '£2.00',
      periodLabel: 'Oct 2026',
    });
    expect(data?.breakdown.map((item) => [item.label, item.formattedAmount])).toEqual([
      ['Prepaid top-ups', '£16.00'],
      ['Remaining credit', '£12.50'],
    ]);
    expect(costCardData(makeSignal({ points: points.slice(0, 2) }))).toBeNull();
    const missingBalance = costCardData(
      makeSignal({
        points: points.filter((point) => point.dimensions?.metric !== 'credit_balance'),
      }),
    );
    expect(missingBalance?.breakdown[1]?.formattedAmount).toBe('Not recorded');
  });

  it('formats currencies for billing cards', () => {
    expect(formatCurrency(12.3, 'GBP')).toBe('£12.30');
    expect(formatCurrency(4, 'USD')).toBe('US$4.00');
  });

  it('builds provider-neutral cost card data from cost-family dimensions', () => {
    const data = costCardData(
      makeSignal({
        template_id: 'manual-cost',
        points: [
          {
            dimensions: {
              family: 'cost',
              metric: 'cost',
              period: 'today',
              posture: 'manual',
              provider: 'Modal',
              service: 'Inference',
              project: 'Sample App',
            },
            value: 1.25,
            unit: 'USD',
            ts: 1,
          },
          {
            dimensions: {
              family: 'cost',
              metric: 'cost',
              period: 'month_to_date',
              posture: 'manual',
              provider: 'Modal',
              service: 'Inference',
              project: 'Sample App',
            },
            value: 18.5,
            unit: 'USD',
            ts: 2,
          },
        ],
      }),
    );

    expect(data).toMatchObject({
      posture: 'manual',
      headline: {
        formattedAmount: 'US$18.50',
        periodLabel: 'month to date',
      },
    });
  });

  it('ignores ordinary numeric signals', () => {
    expect(
      costCardData(
        makeSignal({
          template_id: 'manual-metric',
          points: [{ dimensions: { label: 'Users' }, value: 10, unit: 'people', ts: 1 }],
        }),
      ),
    ).toBeNull();
  });
});
