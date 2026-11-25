import { afterEach, describe, expect, it, vi } from 'vitest';
import { aaFrontier, aaHighlights } from './aa-highlights';

const models = [
  {
    slug: 'model-b',
    name: 'Model B',
    shortName: 'Model B (high)',
    intelligenceIndex: 58,
    price1mOutputTokens: 0,
    intelligenceIndexCostPerTask: { cost: { total: 900 } },
    timescaleData: { medianOutputSpeed: 125 },
  },
  {
    slug: 'model-a',
    name: 'Model A',
    intelligenceIndex: 61,
    price1mOutputTokens: 2.5,
    timescaleData: { medianOutputSpeed: 80 },
  },
];

// Reduced public homepage shape: JSON-LD describes charts; Flight carries initialData.
const homepage = (data: unknown = models, property = 'initialData'): string => {
  const record = `1f:${JSON.stringify(['$', 'div', null, { children: ['$', '$L22', null, { [property]: data }] }])}\n`;
  const middle = Math.floor(record.length / 2);
  const chunks = [record.slice(0, middle), record.slice(middle)];
  return `<script type="application/ld+json">{"@type":"Dataset","name":"Intelligence"}</script>${chunks
    .map(
      (chunk) =>
        `<script nonce="fixture">self.__next_f.push(${JSON.stringify([1, chunk])})</script>`,
    )
    .join('')}`;
};

const mockPage = (html: string): void => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html)));
};

afterEach(() => vi.unstubAllGlobals());

describe('AA public homepage chart data', () => {
  it.each([
    ['intelligence', [61, 58]],
    ['speed', [150, 0]],
    ['price', [0, 2.5]],
  ] as const)(
    'reads %s from public comparison-page initialModels props',
    async (category, values) => {
      mockPage(
        homepage(
          [
            { ...models[0], medianOutputSpeed: 0 },
            { ...models[1], medianOutputSpeed: 150 },
          ],
          'initialModels',
        ),
      );
      const result = await aaHighlights({ category });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.points.map((point) => point.value)).toEqual(values);
      expect(fetch).toHaveBeenCalledWith(
        'https://artificialanalysis.ai/models',
        expect.any(Object),
      );
    },
  );

  it('keeps comparison-page output-token pricing distinct from cost per task', async () => {
    mockPage(
      homepage(
        [
          {
            slug: 'model',
            name: 'Model',
            intelligenceIndex: 50,
            medianOutputSpeed: 80,
            intelligenceIndexCostPerTask: { cost: { total: 900 } },
          },
        ],
        'initialModels',
      ),
    );
    expect(await aaHighlights({ category: 'price' })).toMatchObject({
      ok: false,
      error: { code: 'parse_failed' },
    });
    mockPage(
      homepage(
        [{ slug: 'model', name: 'Model', intelligenceIndex: 50, medianOutputSpeed: 80 }],
        'initialModels',
      ),
    );
    const frontier = await aaFrontier({});
    expect(frontier.ok).toBe(true);
    if (frontier.ok) expect(frontier.points[0]?.dimensions).toMatchObject({ speed: 80, price: '' });
  });

  it.each([
    ['intelligence', [61, 58], ['', '']],
    ['speed', [125, 80], ['tok/s', 'tok/s']],
    ['price', [0, 2.5], ['$/M', '$/M']],
  ] as const)('extracts and ranks %s with its original units', async (category, values, units) => {
    mockPage(homepage());
    const result = await aaHighlights({ category });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.value)).toEqual(values);
    expect(result.points.map((point) => point.unit)).toEqual(units);
    expect(result.points.map((point) => point.dimensions.rank)).toEqual([1, 2]);
    expect(
      result.points.every((point) =>
        point.sourceUrl?.startsWith('https://artificialanalysis.ai/models/'),
      ),
    ).toBe(true);
  });

  it('joins full model metrics without substituting cost per task for output-token pricing', async () => {
    mockPage(homepage());
    const result = await aaFrontier({ limit: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({
      value: 61,
      dimensions: { model: 'Model A', rank: 1, speed: 80, price: 2.5 },
      sourceUrl: 'https://artificialanalysis.ai/models/model-a',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('filters invalid and deprecated entries before applying the limit', async () => {
    mockPage(
      homepage([
        { ...models[0], deprecated: true, intelligenceIndex: 200 },
        { ...models[0], slug: 'https://untrusted.example', intelligenceIndex: 300 },
        { ...models[0], shortName: '', name: '', intelligenceIndex: 400 },
        { ...models[0], intelligenceIndex: '500' },
        null,
        models[1],
      ]),
    );
    const result = await aaHighlights({ category: 'intelligence', limit: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points[0]?.value).toBe(61);
  });

  it('retains the legacy JSON-LD source when it still supplies values', async () => {
    const legacy = {
      '@type': 'Dataset',
      name: 'Intelligence',
      data: [{ label: 'Legacy', intelligenceIndex: 99 }],
    };
    mockPage(`<script type="application/ld+json">${JSON.stringify(legacy)}</script>${homepage()}`);
    const result = await aaHighlights({ category: 'intelligence' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points[0]?.dimensions.model).toBe('Legacy');
  });

  it.each([
    '<script type="application/ld+json">{"@type":"Dataset","name":"Intelligence"}</script>',
    '<script>self.__next_f.push([1,"1f:broken JSON"])</script>',
    '<script>self.__next_f.push(alert("not executed"))</script>',
    homepage([{ slug: 'model', name: 'Missing metrics', intelligenceIndexCostPerTask: 1 }]),
  ])('fails closed when numeric source data is absent or malformed', async (html) => {
    mockPage(html);
    const result = await aaHighlights({ category: 'intelligence' });
    expect(result).toMatchObject({ ok: false, error: { code: 'parse_failed' } });
  });

  it('does not manufacture speed or price for frontier models without measurements', async () => {
    mockPage(homepage([{ slug: 'model', name: 'Model', intelligenceIndex: 40 }]));
    const result = await aaFrontier({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points[0]?.dimensions).toMatchObject({ speed: '', price: '' });
  });
});
