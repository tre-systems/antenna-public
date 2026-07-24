import { describe, expect, it } from 'vitest';
import { manual } from './manual';

describe('manual', () => {
  it('returns a single DataPoint with provided value and label', async () => {
    const result = await manual({ value: 42, unit: 'kg', label: 'weight' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    const [point] = result.points;
    if (!point) throw new Error('expected a point');
    expect(point.value).toBe(42);
    expect(point.unit).toBe('kg');
    expect(point.dimensions).toEqual({ label: 'weight' });
    expect(typeof point.ts).toBe('number');
  });

  it('falls back to the literal "value" label', async () => {
    const result = await manual({ value: 'green' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]?.dimensions).toEqual({ label: 'value' });
    expect(result.points[0]?.value).toBe('green');
  });

  it('tags rawPayload as manual', async () => {
    const result = await manual({ value: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rawPayload).toEqual({ source: 'manual' });
  });
});
