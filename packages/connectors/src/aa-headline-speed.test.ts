import { afterEach, describe, expect, it, vi } from 'vitest';
import { aaFrontier, aaHighlights } from './aa-highlights';

// Reduced comparison-page props: Output Speed reads headline.outputSpeed in tok/s.
const page = (models: unknown[]): string => {
  const record = `2b:${JSON.stringify(['$', '$L2a', null, { initialModels: models }])}\n`;
  const middle = Math.floor(record.length / 2);
  return `<script type="application/ld+json">{"@type":"Dataset","name":"Output Speed"}</script>${[
    record.slice(0, middle),
    record.slice(middle),
  ]
    .map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`)
    .join('')}`;
};

const model = {
  slug: 'model-a',
  name: 'Model A',
  intelligenceIndex: 61,
  price1mOutputTokens: 2.5,
  headline: { outputSpeed: 131.878, timeToFirstToken: 2.23, timeToFirstAnswerToken: 24.74 },
  multiTurn: { timeToFirstToken: 0.83 },
  endToEndTime: 54.3,
  intelligenceIndexTimePerTask: 90,
};

const mockModels = (models: unknown[]): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(new Response(page(models)))),
  );
};

afterEach(() => vi.unstubAllGlobals());

describe('AA headline output speed', () => {
  it('reads headline-only chart props when the Output Speed JSON-LD has no rows', async () => {
    mockModels([model]);
    expect(await aaHighlights({ category: 'speed' })).toMatchObject({
      ok: true,
      points: [{ value: 131.878, unit: 'tok/s', dimensions: { model: 'Model A', rank: 1 } }],
    });
    expect(fetch).toHaveBeenCalledWith('https://artificialanalysis.ai/models', expect.any(Object));
  });

  it('ranks current chart speeds, preserving zero and preferring headline to legacy fields', async () => {
    mockModels([
      {
        ...model,
        slug: 'stopped',
        name: 'Stopped',
        headline: { outputSpeed: 0 },
        medianOutputSpeed: 999,
      },
      model,
      {
        ...model,
        slug: 'fast',
        name: 'Fast',
        headline: { outputSpeed: 150 },
        medianOutputSpeed: 1,
      },
      { ...model, slug: 'invalid', headline: { outputSpeed: '500' }, medianOutputSpeed: 500 },
      { ...model, slug: 'deprecated', headline: { outputSpeed: 600 }, deprecated: true },
    ]);
    const result = await aaHighlights({ category: 'speed', limit: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.points.map(({ value, unit, dimensions }) => ({ value, unit, rank: dimensions.rank })),
    ).toEqual([
      { value: 150, unit: 'tok/s', rank: 1 },
      { value: 131.878, unit: 'tok/s', rank: 2 },
      { value: 0, unit: 'tok/s', rank: 3 },
    ]);
    expect(result.points[0]?.sourceUrl).toBe('https://artificialanalysis.ai/models/fast');
  });

  it('joins headline speed to the same frontier model without changing intelligence or price', async () => {
    mockModels([model]);
    expect(await aaFrontier({})).toMatchObject({
      ok: true,
      points: [{ value: 61, dimensions: { model: 'Model A', speed: 131.878, price: 2.5 } }],
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(
    [
      undefined,
      null,
      {},
      [],
      { outputSpeed: null },
      { outputSpeed: '100' },
      { outputSpeed: -1 },
      { outputSpeed: 'Infinity' },
      { timeToFirstAnswerToken: 24.74 },
    ].map((headline) => ({ headline })),
  )(
    'fails closed for absent or invalid headline speed instead of using time or price',
    async ({ headline }) => {
      mockModels([{ ...model, headline }]);
      expect(await aaHighlights({ category: 'speed' })).toMatchObject({
        ok: false,
        error: { code: 'parse_failed' },
      });
      expect(await aaFrontier({})).toMatchObject({
        ok: true,
        points: [{ dimensions: { speed: '', price: 2.5 } }],
      });
    },
  );
});
