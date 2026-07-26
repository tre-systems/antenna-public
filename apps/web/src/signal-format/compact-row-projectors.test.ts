import { describe, expect, it } from 'vitest';
import { compactRowsCardData } from './compact-rows';
import { makeSignal } from './test-support';

describe('compactRowsCardData market and jobs rows', () => {
  it('shapes sector-movers into all 11 rows with signed-percent chips and ok/urgent tones', () => {
    const signal = makeSignal({
      template_id: 'sector-movers',
      points: [
        ...Array.from({ length: 11 }, (_, i) => ({
          dimensions: {
            metric: 'sector_change',
            ticker: `T${String(i + 1)}`,
            sector: `Sector${String(i + 1)}`,
            rank: String(i + 1),
          },
          value: 2 - i * 0.5,
          unit: '%',
        })),
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(11);
    expect(out?.rows[0]?.title).toBe('Sector1');
    expect(out?.rows[0]?.subtitle).toBe('T1');
    expect(out?.rows[0]?.chip).toBe('+2.00%');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[4]?.chip).toBe('0.00%');
    expect(out?.rows[4]?.chipTone).toBe('muted');
    expect(out?.rows[10]?.chip).toBe('-3.00%');
    expect(out?.rows[10]?.chipTone).toBe('urgent');
    expect(out?.summary).toBe('4 up · 6 down');
  });

  it('shapes karpathy-jobs-snapshot top_role points into rows with exposure chips and ok/info/warn tones', () => {
    const signal = makeSignal({
      template_id: 'karpathy-jobs-snapshot',
      points: [
        {
          dimensions: { metric: 'high_exposure_share' },
          value: '42%',
          source_url: 'https://karpathy.ai/jobs/',
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 1,
            category: 'Computer & mathematical',
            jobs: 4_800_000,
            exposure: 72,
          },
          value: 'Software developers',
          source_url: 'https://karpathy.ai/jobs/role/dev',
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 2,
            category: 'Office & admin',
            jobs: 120_000,
            exposure: 45,
          },
          value: 'Bookkeepers',
          source_url: 'https://karpathy.ai/jobs/role/bk',
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 3,
            category: 'Healthcare support',
            jobs: 850,
            exposure: 18,
          },
          value: 'Home health aides',
          source_url: 'https://karpathy.ai/jobs/role/aide',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);

    const first = out?.rows[0];
    expect(first?.title).toBe('Computer & mathematical');
    expect(first?.subtitle).toBe('5M jobs');
    expect(first?.chip).toBe('72%');
    expect(first?.chipTone).toBe('warn');
    expect(first?.href).toBe('https://karpathy.ai/jobs/role/dev');

    expect(out?.rows[1]?.subtitle).toBe('120k jobs');
    expect(out?.rows[1]?.chip).toBe('45%');
    expect(out?.rows[1]?.chipTone).toBe('info');

    expect(out?.rows[2]?.subtitle).toBe('850 jobs');
    expect(out?.rows[2]?.chip).toBe('18%');
    expect(out?.rows[2]?.chipTone).toBe('ok');

    expect(out?.summary).toBe('Top 3 most exposed');
  });

  it('shapes market-overview into proxy rows with signed-percent chips and a regime summary', () => {
    const signal = makeSignal({
      template_id: 'market-overview',
      points: [
        {
          dimensions: {
            metric: 'market_regime',
            risk_score: 2,
            positive_count: 4,
            negative_count: 1,
          },
          value: 'risk-on',
          source_url: 'https://stooq.com/',
        },
        {
          dimensions: {
            metric: 'market_proxy_change',
            ticker: 'spy.us',
            label: 'S&P 500',
            role: 'equities',
          },
          value: 1.24,
          unit: '%',
          source_url: 'https://stooq.com/q/?s=spy.us',
        },
        {
          dimensions: {
            metric: 'market_proxy_change',
            ticker: 'tlt.us',
            label: '20Y Treasuries',
            role: 'bonds',
          },
          value: -0.42,
          unit: '%',
          source_url: 'https://stooq.com/q/?s=tlt.us',
        },
        {
          dimensions: {
            metric: 'market_proxy_change',
            ticker: 'flat.us',
            label: 'Flat',
            role: 'cash',
          },
          value: 0,
          unit: '%',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);

    const first = out?.rows[0];
    expect(first?.title).toBe('S&P 500');
    expect(first?.subtitle).toBe('spy.us · equities');
    expect(first?.chip).toBe('+1.24%');
    expect(first?.chipTone).toBe('ok');
    expect(first?.href).toBe('https://stooq.com/q/?s=spy.us');

    expect(out?.rows[1]?.chip).toBe('-0.42%');
    expect(out?.rows[1]?.chipTone).toBe('urgent');
    expect(out?.rows[2]?.chipTone).toBe('muted');

    expect(out?.summary).toBe('Risk-on · 4 up · 1 down');
  });

  it('limits karpathy-jobs-snapshot to top 3 by rank, sorted ascending', () => {
    const signal = makeSignal({
      template_id: 'karpathy-jobs-snapshot',
      points: Array.from({ length: 5 }, (_, i) => ({
        dimensions: {
          metric: 'top_role',
          rank: 5 - i,
          category: `Cat${String(5 - i)}`,
          jobs: 10_000,
          exposure: 50,
        },
        value: `Role ${String(5 - i)}`,
      })),
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows).toHaveLength(3);
    expect(out?.rows.map((r) => r.title)).toEqual(['Cat1', 'Cat2', 'Cat3']);
  });
});
