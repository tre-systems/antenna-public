import { describe, expect, it } from 'vitest';
import { displayPoints } from './points';
import { pointLabel } from './labels';
import { pointValueText } from './value';
import { makeSignal } from './test-support';

describe('displayPoints', () => {
  it('sorts GitHub Trending points by rank while preserving other signal order', () => {
    const ranked = makeSignal({
      template_id: 'github-trending',
      points: [
        { dimensions: { source: 'github-trending', rank: '2' }, value: 'two', ts: 0 },
        { dimensions: { source: 'github-trending', rank: '1' }, value: 'one', ts: 0 },
      ],
    });
    expect(displayPoints(ranked).map((point) => pointValueText(point))).toEqual(['one', 'two']);

    const unranked = makeSignal({
      points: [
        { dimensions: { label: 'B' }, value: 2, ts: 0 },
        { dimensions: { label: 'A' }, value: 1, ts: 0 },
      ],
    });
    expect(displayPoints(unranked).map((point) => pointLabel(point))).toEqual(['B', 'A']);
  });

  it('picks the latest fx-pair point using observed_at when the API sends it', () => {
    // Regression: the API sends wire timestamps, so selecting on `point.ts` left the hero empty.
    const fx = makeSignal({
      template_id: 'fx-pair',
      config: { base: 'AUD', quote: 'USD' },
      points: [
        {
          dimensions: { pair: 'AUD/USD' },
          value: 0.713,
          unit: 'USD',
          observed_at: 4,
          fetched_at: 1,
        },
        { dimensions: { pair: 'AUD/USD' }, value: 0.7117, unit: 'USD', fetched_at: 3 },
        { dimensions: { pair: 'AUD/USD' }, value: 0.7099, unit: 'USD', fetched_at: 2 },
        { dimensions: { pair: 'AUD/USD' }, value: 0.7081, unit: 'USD', fetched_at: 1 },
      ],
    });
    const out = displayPoints(fx);
    expect(out).toHaveLength(1);
    expect(out[0]?.value).toBe(0.713);
  });
});
