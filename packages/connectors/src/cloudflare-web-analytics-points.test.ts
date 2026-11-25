import { describe, expect, it } from 'vitest';
import { hostTrafficPoints, type RumRow } from './cloudflare-web-analytics-points';

const row = (date: string, host: string, visits: number, sampleInterval: number): RumRow => ({
  count: visits,
  avg: { sampleInterval },
  sum: { visits },
  dimensions: { date, requestHost: host },
});

describe('web analytics sampling provenance', () => {
  it('marks only affected host counts and comparisons, without scaling estimates twice', () => {
    const points = hostTrafficPoints(
      ['mixed.example', 'exact.example', 'unseen.example'],
      [
        row('2026-09-14', 'mixed.example', 3, 1),
        row('2026-09-09', 'mixed.example', 10, 1.6666666666666667),
        row('2026-09-08', 'exact.example', 4, 1),
        row('2026-09-03', 'exact.example', 2, 10),
        row('2026-08-01', 'mixed.example', 40, 10),
        row('2026-09-14', 'untracked.example', 100, 100),
      ],
      7,
      new Date('2026-09-14T12:00:00Z'),
    );
    expect(points).toMatchObject([
      { value: 13, dimensions: { visits_quality: 'estimated', comparison_quality: 'estimated' } },
      { value: 4, dimensions: { visits_quality: 'unsampled', comparison_quality: 'estimated' } },
      { value: 0, dimensions: { visits_quality: 'unsampled', telemetry_state: 'unseen' } },
    ]);
  });

  it('does not mark current counts or comparisons from sampled last-seen history', () => {
    const [point] = hostTrafficPoints(
      ['active.example'],
      [row('2026-09-14', 'active.example', 4, 1), row('2026-08-01', 'active.example', 40, 10)],
      7,
      new Date('2026-09-14T12:00:00Z'),
    );
    expect(point).toMatchObject({
      value: 4,
      dimensions: {
        visits_quality: 'unsampled',
        comparison_quality: 'unsampled',
      },
    });
  });
});
