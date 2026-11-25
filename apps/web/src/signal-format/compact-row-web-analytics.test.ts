import { describe, expect, it } from 'vitest';
import { compactRowsCardData } from './compact-rows';
import { makeSignal } from './test-support';

describe('web visit estimate labels', () => {
  it('labels mixed totals and sampled rows, keeping unsampled counts distinct from estimates', () => {
    const result = compactRowsCardData(
      makeSignal({
        template_id: 'cloudflare-web-analytics',
        points: ['estimated', 'unsampled'].map((quality, index) => ({
          value: index ? 4 : 13,
          dimensions: {
            metric: 'host_traffic',
            host: `${quality}.example`,
            previous: 2,
            change: 100,
            telemetry_state: 'active',
            visits_quality: quality,
            comparison_quality: 'estimated',
          },
        })),
      }),
    );
    expect(result?.summary).toBe('17 estimated visits · 2/2 active');
    expect(result?.rows).toMatchObject([
      { chip: '13 est. visits', subtitle: '+100% vs prior · estimated' },
      { chip: '4 visits', subtitle: '+100% vs prior · estimated' },
    ]);
  });

  it('does not label unsampled counts as estimates because historical comparisons are sampled', () => {
    const result = compactRowsCardData(
      makeSignal({
        template_id: 'cloudflare-web-analytics',
        points: [
          {
            value: 4,
            dimensions: {
              metric: 'host_traffic',
              host: 'exact.example',
              previous: 2,
              change: 100,
              telemetry_state: 'active',
              visits_quality: 'unsampled',
              comparison_quality: 'estimated',
            },
          },
        ],
      }),
    );
    expect(result?.summary).toBe('4 visits · 1/1 active');
    expect(result?.rows[0]?.chip).toBe('4 visits');
  });
});
