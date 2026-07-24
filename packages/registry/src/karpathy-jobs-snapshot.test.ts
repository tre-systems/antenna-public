import { describe, expect, it } from 'vitest';
import { karpathyJobsSnapshotTemplate } from './karpathy-jobs-snapshot';

const anyHintMatches = (prompt: string): boolean =>
  karpathyJobsSnapshotTemplate.matchHints.some((rx) => rx.test(prompt));

describe('karpathyJobsSnapshotTemplate.matchHints', () => {
  it.each([
    'Karpathy jobs',
    'karpathy jobs snapshot',
    'karpathy hiring',
    'Karpathy careers',
    'AI jobs exposure',
    'job market visualizer',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'AZN.L yearly graph'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('karpathyJobsSnapshotTemplate metadata', () => {
  it('uses attribution and daily refresh', () => {
    expect(karpathyJobsSnapshotTemplate.paramKeys).toEqual([]);
    expect(karpathyJobsSnapshotTemplate.rightsStatus).toBe('with-attribution');
    expect(karpathyJobsSnapshotTemplate.defaultRefreshSeconds).toBe(86_400);
  });
});
