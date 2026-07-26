import { describe, expect, it } from 'vitest';
import { reorderForDrop } from './signal-order';
import { sampleSignal } from './test-support';

describe('reorderForDrop', () => {
  it('moves the dragged signal to the target position', () => {
    const list = [sampleSignal('a'), sampleSignal('b'), sampleSignal('c'), sampleSignal('d')];
    const next = reorderForDrop(list, 'd', 'b');
    expect(next.map((b) => b.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('swaps with the immediate next neighbour instead of being a no-op', () => {
    // Regression: insert-before-target semantics made a one-slot forward drag do nothing.
    const list = [sampleSignal('a'), sampleSignal('b'), sampleSignal('c')];
    const next = reorderForDrop(list, 'a', 'b');
    expect(next.map((b) => b.id)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op when dragged === target', () => {
    const list = [sampleSignal('a'), sampleSignal('b')];
    expect(reorderForDrop(list, 'a', 'a')).toBe(list);
  });

  it('is a no-op when either id is unknown', () => {
    const list = [sampleSignal('a'), sampleSignal('b')];
    expect(reorderForDrop(list, 'x', 'a')).toBe(list);
    expect(reorderForDrop(list, 'a', 'x')).toBe(list);
  });
});
