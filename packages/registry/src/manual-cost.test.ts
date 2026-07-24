import { describe, expect, it } from 'vitest';
import { manualCostTemplate } from './manual-cost';

describe('manualCostTemplate', () => {
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
