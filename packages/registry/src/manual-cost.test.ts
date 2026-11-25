import { describe, expect, it } from 'vitest';
import { manualCostTemplate } from './manual-cost';

describe('manualCostTemplate', () => {
  it('requires both billing components and their total without folding in prepaid credit', () => {
    const config = {
      amount: 5,
      fixedFees: 5,
      usageOverages: 0,
      currency: 'USD',
      period: 'month_to_date',
      provider: 'Cloudflare',
    };
    const schema = manualCostTemplate.configSchema;
    expect(schema.parse(config)).toMatchObject(config);
    expect(
      schema.safeParse({ ...config, amount: 0.3, fixedFees: 0.1, usageOverages: 0.2 }).success,
    ).toBe(true);
    expect(schema.safeParse({ ...config, amount: 0, fixedFees: 0 }).success).toBe(true);
    for (const patch of [
      { amount: 0 },
      { amount: '' },
      { amount: 1e-20, fixedFees: 0, usageOverages: 0 },
      { fixedFees: undefined },
      { usageOverages: undefined },
      { fixedFees: -1 },
      { usageOverages: -1 },
      { usageOverages: Infinity },
      { fixedFees: '5' },
      { fixedFees: 1e308, usageOverages: 1e308 },
      { topUps: 16 },
      { creditBalance: 1 },
    ])
      expect(schema.safeParse({ ...config, ...patch }).success).toBe(false);
  });

  it('validates separated optional balances and observation dates without inventing missing values', () => {
    const base = { amount: 2, currency: 'GBP', period: 'month_to_date', provider: 'Google Cloud' };
    const schema = manualCostTemplate.configSchema;
    expect(schema.parse(base)).not.toHaveProperty('creditBalance');
    expect(
      schema.parse({
        ...base,
        topUps: 0,
        creditBalance: -0.01,
        asOf: '2026-10-31T06:00:00Z',
        periodMonth: '2026-10',
      }),
    ).toMatchObject({ topUps: 0, creditBalance: -0.01 });
    for (const patch of [
      { topUps: -1 },
      { creditBalance: Infinity },
      { asOf: 'yesterday' },
      { creditBalanceAsOf: 'bad' },
      { periodMonth: '2026-13' },
    ]) {
      expect(schema.safeParse({ ...base, ...patch }).success).toBe(false);
    }
  });

  it('extracts a complete month-to-date cost from a natural prompt', () => {
    const extract = manualCostTemplate.paramExtractors;
    const prompt = 'track £12.34 Cloudflare cost month to date';

    expect(extract.provider?.(prompt)).toBe('Cloudflare');
    expect(extract.amount?.(prompt)).toBe('12.34');
    expect(extract.currency?.(prompt)).toBe('GBP');
    expect(extract.period?.(prompt)).toBe('month_to_date');
  });

  it('recognises the providers found in the project audit', () => {
    const provider = manualCostTemplate.paramExtractors.provider;

    expect(provider?.('AWS bill $5 today')).toBe('AWS');
    expect(provider?.('Gemini spend 2 USD')).toBe('Google Cloud');
    expect(provider?.('Anthropic cost $3')).toBe('Anthropic');
  });

  it('defaults service while coercing planner amount input', () => {
    const parsed = manualCostTemplate.configSchema.safeParse({
      amount: '8.50',
      currency: 'USD',
      period: 'today',
      provider: 'Modal',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({ amount: 8.5, service: 'All services' });
  });

  it('accepts an empty amount only as an explicit setup placeholder', () => {
    const parsed = manualCostTemplate.configSchema.safeParse({
      amount: '',
      currency: 'GBP',
      period: 'month_to_date',
      provider: 'Cloudflare',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({ amount: '' });
  });
});
