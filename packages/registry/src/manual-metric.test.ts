import { describe, expect, it } from 'vitest';
import { manualMetricTemplate } from './manual-metric';

const anyHintMatches = (prompt: string): boolean =>
  manualMetricTemplate.matchHints.some((rx) => rx.test(prompt));

describe('manualMetricTemplate.matchHints', () => {
  it.each(['add a manual signal', 'I want to track a number'])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Berlin', 'bitcoin price', 'EUR/USD rate'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('manualMetricTemplate.paramExtractors', () => {
  it('returns undefined for every key (planner-driven)', () => {
    const { value, unit, label } = manualMetricTemplate.paramExtractors;
    expect(value?.('I want to track a number')).toBeUndefined();
    expect(unit?.('I want to track a number')).toBeUndefined();
    expect(label?.('I want to track a number')).toBeUndefined();
  });
});

describe('manualMetricTemplate.adapter', () => {
  it('errors when no value is supplied', async () => {
    const result = await manualMetricTemplate.adapter({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('emits a DataPoint when a value is supplied', async () => {
    const result = await manualMetricTemplate.adapter({ value: 7, unit: 'kg', label: 'weight' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]?.value).toBe(7);
    expect(result.points[0]?.unit).toBe('kg');
    expect(result.points[0]?.dimensions).toEqual({ label: 'weight' });
  });
});
