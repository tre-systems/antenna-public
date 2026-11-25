import { describe, expect, it } from 'vitest';
import { toDisplayPoints } from './read-model';
import type { PointShape } from './types';

const point = (verified: boolean): PointShape => ({
  metric_key: 'stars',
  observed_at: 1,
  fetched_at: 1,
  value: 42,
  value_text: null,
  unit: null,
  dimensions: verified ? { visibility: 'public' } : null,
  source_url: null,
  display: { label: '', source_url: null },
});

describe('public repository provenance', () => {
  it('hides older unverified snapshots while allowing newly verified public points', () => {
    expect(toDisplayPoints('github-repo-activity', [point(false)])).toEqual([]);
    expect(toDisplayPoints('github-repo-activity', [point(true)])).toHaveLength(1);
    expect(toDisplayPoints('fx-pair', [point(false)])).toHaveLength(1);
  });
});
