import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import { makeSignal, NOW } from './signal-card-test-fixtures';

describe('cost snapshots', () => {
  it('renders the billing total without omitting fixed subscription fees', () => {
    const signal = makeSignal({
      template_id: 'manual-cost',
      points: [
        {
          dimensions: { family: 'cost', metric: 'cost', as_of: '2026-10-31T10:00:00Z' },
          value: 5,
          unit: 'USD',
        },
        {
          dimensions: { family: 'cost', metric: 'fixed_subscription_fees' },
          value: 5,
          unit: 'USD',
        },
        { dimensions: { family: 'cost', metric: 'usage_overages' }, value: 0, unit: 'USD' },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    for (const text of [
      'Fees + usage (pre-tax)',
      'Fixed subscription fees',
      'Usage overages',
      'US$5.00',
      'US$0.00',
      'Current billing period',
    ])
      expect(html).toContain(text);
    expect(html).toContain('data-status="snapshot"');
    expect(html).not.toContain('Invoice total');
  });

  it('shows separated amounts and source dates despite a later successful dispatch', () => {
    const signal = makeSignal({
      template_id: 'manual-cost',
      points: [
        {
          dimensions: {
            family: 'cost',
            metric: 'cost',
            as_of: '2026-10-30T12:00:00Z',
            period_month: '2026-10',
          },
          value: 2.004321,
          unit: 'GBP',
        },
        { dimensions: { family: 'cost', metric: 'prepaid_top_up' }, value: 16, unit: 'GBP' },
        {
          dimensions: { family: 'cost', metric: 'credit_balance', as_of: '2026-10-28T12:00:00Z' },
          value: 12.5,
          unit: 'GBP',
        },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    for (const text of [
      'Usage cost',
      '£2.00',
      'Prepaid top-ups',
      '£16.00',
      'Remaining credit',
      '£12.50',
      'Oct 2026',
      '30 Oct 2026',
      '28 Oct 2026',
    ])
      expect(html).toContain(text);
    expect(html).toContain('data-status="snapshot"');
    expect(html).not.toContain('data-status="live"');
    expect(html).not.toContain('£18.00');
    expect(html).not.toContain('Every 24h');
  });

  it('does not pass off a legacy dispatch time as the source observation date', () => {
    const signal = makeSignal({
      template_id: 'manual-cost',
      config: { amount: 4 },
      points: [
        {
          dimensions: { family: 'cost', metric: 'cost', posture: 'manual' },
          value: 4,
          unit: 'GBP',
          ts: NOW,
        },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('Date unknown');
    expect(html).toContain('data-status="snapshot"');
  });
});
