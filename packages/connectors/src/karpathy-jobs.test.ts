import { afterEach, describe, expect, it, vi } from 'vitest';
import { karpathyJobs, normaliseJobs, summariseJobs } from './karpathy-jobs';

const rows = [
  {
    title: 'Software Developers',
    category: 'computer-and-information-technology',
    pay: 130160,
    jobs: 1851700,
    outlook: 17,
    exposure: 9,
    url: 'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm',
  },
  {
    title: 'Registered Nurses',
    category: 'healthcare',
    pay: 93000,
    jobs: 3175100,
    outlook: 6,
    exposure: 2,
    url: 'https://www.bls.gov/ooh/healthcare/registered-nurses.htm',
  },
  {
    title: 'Accountants and Auditors',
    category: 'business-and-financial',
    pay: 79920,
    jobs: 1562000,
    outlook: 6,
    exposure: 8,
    url: 'https://www.bls.gov/ooh/business-and-financial/accountants-and-auditors.htm',
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normaliseJobs', () => {
  it('keeps rows with required title/category/jobs/exposure fields', () => {
    expect(normaliseJobs([...rows, { title: 'Broken', jobs: 1 }])).toHaveLength(3);
  });
});

describe('summariseJobs', () => {
  it('computes weighted exposure and high-exposure employment', () => {
    const summary = summariseJobs(normaliseJobs(rows));
    expect(summary.occupations).toBe(3);
    expect(summary.totalJobs).toBe(6_588_800);
    expect(summary.weightedExposure).toBeCloseTo(5.39);
    expect(summary.highExposureJobs).toBe(3_413_700);
    expect(summary.highExposureShare).toBeCloseTo(51.809);
  });
});

describe('karpathyJobs', () => {
  it('returns a compact research snapshot from the static data JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await karpathyJobs({});

    expect(fetch).toHaveBeenCalledWith('https://karpathy.ai/jobs/data.json', {
      headers: { Accept: 'application/json', 'User-Agent': 'antenna' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.dimensions.metric)).toEqual([
      'occupations',
      'jobs_analyzed',
      'weighted_ai_exposure',
      'high_exposure_jobs',
      'high_exposure_share',
      'top_role',
      'top_role',
    ]);
    expect(result.points[2]?.value).toBe('5.4 / 10');
    expect(result.points[4]?.value).toBe('52%');
    expect(result.points[5]).toMatchObject({
      dimensions: {
        metric: 'top_role',
        rank: 1,
        category: 'computer-and-information-technology',
        jobs: 1851700,
        exposure: 9,
      },
      value: 'Software Developers',
      unit: 'median pay $130,160',
      sourceUrl:
        'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm',
    });
    expect(result.points[6]).toMatchObject({
      dimensions: {
        metric: 'top_role',
        rank: 2,
        category: 'business-and-financial',
        jobs: 1562000,
        exposure: 8,
      },
      value: 'Accountants and Auditors',
      unit: 'median pay $79,920',
    });
    expect(result.points[0]?.sourceUrl).toBe('https://karpathy.ai/jobs/');
    expect(result.rawPayload).toMatchObject({
      source: 'https://karpathy.ai/jobs/data.json',
      sourcePage: 'https://karpathy.ai/jobs/',
      topHighExposureRoles: [
        { title: 'Software Developers' },
        { title: 'Accountants and Auditors' },
      ],
    });
  });

  it('maps malformed payloads to parse_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const result = await karpathyJobs({});
    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'no jobs parsed' },
    });
  });
});
