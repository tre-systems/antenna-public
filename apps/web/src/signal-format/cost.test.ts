import { describe, expect, it } from 'vitest';
import { costCardData, formatCurrency } from './cost';
import { makeSignal } from './test-support';

describe('cost formatting', () => {
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
              project: 'Talata',
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
              project: 'Talata',
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
