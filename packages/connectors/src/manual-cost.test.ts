import { describe, expect, it, vi } from 'vitest';
import { manualCost } from './manual-cost';

describe('manualCost', () => {
  it('keeps a billing total separate from its fixed fee and overage components', async () => {
    const result = await manualCost({
      amount: 5,
      fixedFees: 5,
      usageOverages: 0,
      currency: 'USD',
      period: 'month_to_date',
      provider: 'Cloudflare',
      asOf: '2026-10-31T10:00:00Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => [point.dimensions.metric, point.value])).toEqual([
      ['cost', 5],
      ['fixed_subscription_fees', 5],
      ['usage_overages', 0],
    ]);
    expect(result.points.every((point) => point.ts === Date.parse('2026-10-31T10:00:00Z'))).toBe(
      true,
    );
  });

  it('keeps usage, top-ups, and balance independent with stable source dates across refreshes', async () => {
    const config = {
      amount: 2.004321,
      topUps: 16,
      creditBalance: 12.5,
      asOf: '2026-10-31T06:00:00Z',
      creditBalanceAsOf: '2026-10-31T07:00:00Z',
      currency: 'GBP',
      period: 'month_to_date',
      periodMonth: '2026-10',
      provider: 'Google Cloud',
    };
    const result = await manualCost(config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => [point.dimensions.metric, point.value])).toEqual([
      ['cost', 2.004321],
      ['prepaid_top_up', 16],
      ['credit_balance', 12.5],
    ]);
    expect(result.points[0]?.ts).toBe(Date.parse(config.asOf));
    expect(result.points[2]?.ts).toBe(Date.parse(config.creditBalanceAsOf));
    expect(result.points[2]?.dimensions.period).toBe('balance');
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-02T12:00:00Z'));
    try {
      expect(await manualCost(config)).toEqual(result);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('emits a private cost-family point with attribution dimensions', async () => {
    const result = await manualCost({
      amount: 12.34,
      currency: 'GBP',
      period: 'month_to_date',
      provider: 'Cloudflare',
      service: 'Workers',
      project: 'Antenna',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]).toMatchObject({
      dimensions: {
        family: 'cost',
        metric: 'cost',
        period: 'month_to_date',
        posture: 'manual',
        provider: 'Cloudflare',
        service: 'Workers',
        project: 'Antenna',
      },
      value: 12.34,
      unit: 'GBP',
    });
    expect(result.rawPayload).toEqual({ source: 'manual' });
  });

  it('uses an all-services dimension when no service is supplied', async () => {
    const result = await manualCost({
      amount: 5,
      currency: 'USD',
      period: 'today',
      provider: 'Groq',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]?.dimensions.service).toBe('All services');
  });

  it('returns an explicit setup state instead of inventing a zero amount', async () => {
    const result = await manualCost({
      amount: '',
      currency: 'GBP',
      period: 'month_to_date',
      provider: 'Cloudflare',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unknown',
        message: 'setup_required: Enter the current amount in card settings.',
      },
    });
  });
});
