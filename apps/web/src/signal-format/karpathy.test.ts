import { describe, expect, it } from 'vitest';
import { karpathyCardData } from './karpathy';
import type { ApiSignal } from '../api';

describe('karpathyCardData', () => {
  const NOW = Date.now();
  const baseSignal: ApiSignal = {
    id: 'k1',
    template_id: 'karpathy-jobs-snapshot',
    visibility: 'private',
    config: {},
    refresh_seconds: 604_800,
    status: {
      status: 'live',
      last_ok_at: NOW,
      last_attempt_at: NOW,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [
      { dimensions: { metric: 'occupations' }, value: 341, ts: NOW },
      { dimensions: { metric: 'jobs_analyzed' }, value: 143_066_500, unit: 'jobs', ts: NOW },
      {
        dimensions: { metric: 'weighted_ai_exposure' },
        value: null,
        value_text: '4.9 / 10',
        ts: NOW,
      },
      { dimensions: { metric: 'high_exposure_jobs' }, value: 49_009_400, unit: 'jobs', ts: NOW },
      { dimensions: { metric: 'high_exposure_share' }, value: null, value_text: '34%', ts: NOW },
    ],
  };

  it('shapes the five summary points into a hero + context view', () => {
    expect(karpathyCardData(baseSignal)).toEqual({
      share: '34%',
      weighted: '4.9 / 10',
      occupations: '341',
      totalJobs: '143M',
      highJobs: '49M',
      topRoles: [],
    });
  });

  it('returns null for signals that are not karpathy-jobs-snapshot', () => {
    expect(karpathyCardData({ ...baseSignal, template_id: 'fx-pair' })).toBeNull();
  });

  it('returns null when no points have arrived yet', () => {
    expect(karpathyCardData({ ...baseSignal, points: [] })).toBeNull();
  });

  it('fills missing metrics with an em-dash so the layout never breaks', () => {
    const partial: ApiSignal = {
      ...baseSignal,
      points: [
        { dimensions: { metric: 'high_exposure_share' }, value: null, value_text: '34%', ts: NOW },
      ],
    };
    expect(karpathyCardData(partial)).toEqual({
      share: '34%',
      weighted: '—',
      occupations: '—',
      totalJobs: '—',
      highJobs: '—',
      topRoles: [],
    });
  });

  it('surfaces up to 5 top exposed roles, sorted by rank', () => {
    const withRoles: ApiSignal = {
      ...baseSignal,
      points: [
        ...baseSignal.points,
        { dimensions: { metric: 'top_role', rank: 3 }, value: 'Accountants', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 1 }, value: 'Programmers', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 2 }, value: 'Mathematicians', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 4 }, value: 'Auditors', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 5 }, value: 'Web developers', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 6 }, value: 'Loan officers', ts: NOW },
        { dimensions: { metric: 'top_role', rank: 7 }, value: 'Tax preparers', ts: NOW },
      ],
    };
    expect(karpathyCardData(withRoles)?.topRoles).toEqual([
      'Programmers',
      'Mathematicians',
      'Accountants',
      'Auditors',
      'Web developers',
    ]);
  });

  it('handles string-typed rank dimensions from the wire shape', () => {
    const stringRanks: ApiSignal = {
      ...baseSignal,
      points: [
        ...baseSignal.points,
        { dimensions: { metric: 'top_role', rank: '2' }, value: 'B', ts: NOW },
        { dimensions: { metric: 'top_role', rank: '1' }, value: 'A', ts: NOW },
      ],
    };
    expect(karpathyCardData(stringRanks)?.topRoles).toEqual(['A', 'B']);
  });
});
