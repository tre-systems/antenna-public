import { describe, expect, it } from 'vitest';
import { manualCost } from './manual-cost';

describe('manualCost', () => {
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
