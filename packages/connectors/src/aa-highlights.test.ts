import { afterEach, describe, expect, it, vi } from 'vitest';
import { aaFrontier, aaHighlights } from './aa-highlights';

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeDataset = (name: string, items: object[]): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    data: items,
  });

const makeHtml = (...datasets: string[]): string =>
  `<html><body>${datasets.map((d) => `<script type="application/ld+json">${d}</script>`).join('')}</body></html>`;

const INTEL_ITEMS = [
  { label: 'GPT-5.5 (xhigh)', intelligenceIndex: 60.24, detailsUrl: '/models/gpt-5-5' },
  {
    label: 'Claude Opus 4.7 (max)',
    intelligenceIndex: 57.28,
    detailsUrl: '/models/claude-opus-4-7',
  },
  {
    label: 'Gemini 3.1 Pro Preview',
    intelligenceIndex: 57.18,
    detailsUrl: '/models/gemini-3-1-pro-preview',
  },
  { label: 'Kimi K2.6', intelligenceIndex: 53.9, detailsUrl: '/models/kimi-k2-6' },
  { label: 'MiMo-V2.5-Pro', intelligenceIndex: 53.83, detailsUrl: '/models/mimo-v2-5-pro' },
  { label: 'Grok 4.3 (high)', intelligenceIndex: 53.2, detailsUrl: '/models/grok-4-3' },
];

const SPEED_ITEMS = [
  { label: 'gpt-oss-120b (high)', medianOutputSpeed: 248.28, detailsUrl: '/models/gpt-oss-120b' },
  {
    label: 'NVIDIA Nemotron 3 Super',
    medianOutputSpeed: 174.51,
    detailsUrl: '/models/nvidia-nemotron',
  },
  { label: 'Gemini 3.1 Pro Preview', medianOutputSpeed: 126.64, detailsUrl: '/models/gemini-3-1' },
];

const PRICE_ITEMS = [
  {
    label: 'gpt-oss-120b (high)',
    pricePerMillionTokens: 0.195,
    detailsUrl: '/models/gpt-oss-120b',
  },
  {
    label: 'NVIDIA Nemotron 3 Super',
    pricePerMillionTokens: 0.275,
    detailsUrl: '/models/nvidia-nemotron',
  },
  { label: 'Grok 4.3 (high)', pricePerMillionTokens: 0.64, detailsUrl: '/models/grok-4-3' },
];

const mockFetch = (html: string, status = 200) => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response(html, { status, headers: { 'content-type': 'text/html' } })),
  );
};

const fullHtml = makeHtml(
  makeDataset('Intelligence', INTEL_ITEMS),
  makeDataset('Speed', SPEED_ITEMS),
  makeDataset('Price', PRICE_ITEMS),
);

describe('aaHighlights', () => {
  it('extracts intelligence top 5 by default limit', async () => {
    mockFetch(fullHtml);

    const result = await aaHighlights({ category: 'intelligence' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(5);

    const first = result.points[0];
    expect(first?.dimensions.model).toBe('GPT-5.5 (xhigh)');
    expect(first?.dimensions.metric).toBe('aa_intelligence');
    expect(first?.dimensions.rank).toBe(1);
    expect(first?.value).toBeCloseTo(60.24);
    expect(first?.unit).toBe('');
    expect(first?.sourceUrl).toBe('https://artificialanalysis.ai/models/gpt-5-5');
  });

  it('reads intelligence under the new artificialAnalysisIntelligenceIndex key', async () => {
    // AA renamed the field on the live site in late May 2026. The connector
    // should prefer the new key when present.
    const renamedItems = [
      {
        label: 'GPT-5.5 (xhigh)',
        artificialAnalysisIntelligenceIndex: 61.5,
        detailsUrl: '/models/gpt-5-5',
      },
      {
        label: 'Claude Opus 4.7 (max)',
        artificialAnalysisIntelligenceIndex: 58.1,
        detailsUrl: '/models/claude-opus-4-7',
      },
    ];
    mockFetch(makeHtml(makeDataset('Intelligence', renamedItems)));

    const result = await aaHighlights({ category: 'intelligence' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(2);
    expect(result.points[0]?.value).toBeCloseTo(61.5);
    expect(result.points[1]?.dimensions.model).toBe('Claude Opus 4.7 (max)');
  });

  it('extracts speed entries', async () => {
    mockFetch(fullHtml);

    const result = await aaHighlights({ category: 'speed' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(3);
    expect(result.points[0]?.dimensions.metric).toBe('aa_speed');
    expect(result.points[0]?.dimensions.model).toBe('gpt-oss-120b (high)');
    expect(result.points[0]?.value).toBeCloseTo(248.28);
    expect(result.points[0]?.unit).toBe('tok/s');
  });

  it('reads speed under alternate output speed keys', async () => {
    mockFetch(
      makeHtml(
        makeDataset('Speed', [
          { label: 'Fast Model', outputSpeed: 321.5, detailsUrl: '/models/fast' },
          { label: 'Fallback Model', speed: 210.25, detailsUrl: '/models/fallback' },
        ]),
      ),
    );

    const result = await aaHighlights({ category: 'speed' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.value)).toEqual([321.5, 210.25]);
    expect(result.points.every((point) => point.unit === 'tok/s')).toBe(true);
  });

  it('extracts price entries', async () => {
    mockFetch(fullHtml);

    const result = await aaHighlights({ category: 'price' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(3);
    expect(result.points[0]?.dimensions.metric).toBe('aa_price');
    expect(result.points[0]?.value).toBeCloseTo(0.195);
    expect(result.points[0]?.unit).toBe('$/M');
  });

  it('reads price under alternate output price keys', async () => {
    mockFetch(
      makeHtml(
        makeDataset('Price', [
          { label: 'Cheap Model', outputPrice: 0.12, detailsUrl: '/models/cheap' },
          { label: 'Fallback Model', price: 0.34, detailsUrl: '/models/fallback' },
        ]),
      ),
    );

    const result = await aaHighlights({ category: 'price' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.value)).toEqual([0.12, 0.34]);
    expect(result.points.every((point) => point.unit === '$/M')).toBe(true);
  });

  it('reads price from the current AA pricing dataset shape', async () => {
    mockFetch(
      makeHtml(
        makeDataset('Pricing: Cache Hit, Input, and Output', [
          {
            label: 'gpt-oss-20B (high)',
            pricing: [
              { '@type': 'PropertyValue', name: 'inputPrice', value: 0.05 },
              { '@type': 'PropertyValue', name: 'outputPrice', value: 0.2 },
            ],
            detailsUrl: '/models/gpt-oss-20b',
          },
          {
            label: 'DeepSeek V4 Pro',
            pricing: [
              { '@type': 'PropertyValue', name: 'inputPrice', value: 0.28 },
              { '@type': 'PropertyValue', name: 'outputPrice', value: 0.42 },
            ],
            detailsUrl: '/models/deepseek-v4-pro',
          },
        ]),
      ),
    );

    const result = await aaHighlights({ category: 'price' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.value)).toEqual([0.2, 0.42]);
    expect(result.points[0]?.sourceUrl).toBe('https://artificialanalysis.ai/models/gpt-oss-20b');
  });

  it('respects custom limit', async () => {
    mockFetch(fullHtml);

    const result = await aaHighlights({ category: 'intelligence', limit: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(3);
  });

  it('fails with parse_failed when category dataset is missing', async () => {
    mockFetch(makeHtml(makeDataset('Intelligence', INTEL_ITEMS)));

    const result = await aaHighlights({ category: 'speed' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
    expect(result.error.message).toContain('Speed');
  });

  it('fails with fetch_failed on non-2xx', async () => {
    mockFetch('', 503);

    const result = await aaHighlights({ category: 'intelligence' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('503');
  });

  it('fails with fetch_failed when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await aaHighlights({ category: 'intelligence' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('network error');
  });
});

describe('aaFrontier', () => {
  it('joins intelligence, speed, and price for the same frontier models in one fetch', async () => {
    mockFetch(
      makeHtml(
        makeDataset('Intelligence', [
          { label: 'Model A', intelligenceIndex: 61, detailsUrl: '/models/a' },
          { label: 'Model B', intelligenceIndex: 58, detailsUrl: '/models/b' },
        ]),
        makeDataset('Speed', [
          { label: 'Model A', medianOutputSpeed: 125 },
          { label: 'Model B', medianOutputSpeed: 80 },
        ]),
        makeDataset('Price', [
          { label: 'Model A', pricePerMillionTokens: 2.5 },
          { label: 'Model B', pricePerMillionTokens: 1.25 },
        ]),
      ),
    );

    const result = await aaFrontier({ limit: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toMatchObject({
      dimensions: {
        metric: 'aa_frontier',
        rank: 1,
        model: 'Model A',
        speed: 125,
        price: 2.5,
      },
      value: 61,
      unit: 'index',
      sourceUrl: 'https://artificialanalysis.ai/models/a',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
