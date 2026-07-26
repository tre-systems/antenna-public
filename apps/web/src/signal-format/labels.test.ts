import { describe, expect, it } from 'vitest';
import { pointLabel } from './labels';

describe('pointLabel', () => {
  it('prefers server-resolved point display labels', () => {
    expect(
      pointLabel({
        dimensions: { metric: 'recent_vulnerability', rank: '1' },
        value: null,
        display: { label: 'Server label', source_url: null },
      }),
    ).toBe('Server label');
  });

  it('prefers a known metric and maps it to a short human label', () => {
    expect(
      pointLabel({ dimensions: { location: 'London', metric: 'temperature' }, value: 13, ts: 0 }),
    ).toBe('Temp');
    expect(pointLabel({ dimensions: { metric: 'next_event' }, value: '...', ts: 0 })).toBe('Next');
    expect(pointLabel({ dimensions: { metric: 'pm2_5' }, value: 6, ts: 0 })).toBe('PM2.5');
  });

  it('humanises an unknown metric (underscore → space, title case)', () => {
    expect(pointLabel({ dimensions: { metric: 'foo_bar' }, value: 1, ts: 0 })).toBe('Foo Bar');
  });

  it('strips the exchange suffix from a ticker dimension', () => {
    expect(
      pointLabel({ dimensions: { ticker: 'VTI.US', exchange: 'STOOQ' }, value: 360, ts: 0 }),
    ).toBe('VTI');
    expect(
      pointLabel({ dimensions: { ticker: 'BA.UK', exchange: 'STOOQ' }, value: 1900, ts: 0 }),
    ).toBe('BA');
  });

  it('uses pair or label as a fallback', () => {
    expect(pointLabel({ dimensions: { pair: 'EUR/USD' }, value: 1.1, ts: 0 })).toBe('EUR/USD');
    expect(pointLabel({ dimensions: { label: 'Custom' }, value: 1, ts: 0 })).toBe('Custom');
  });

  it('uses rank labels for ranked-list signals', () => {
    expect(
      pointLabel({
        dimensions: { source: 'github-trending', rank: '1' },
        value: 'owner/repo',
        ts: 0,
      }),
    ).toBe('#1');
  });

  it('uses compact labels for commodity metrics', () => {
    expect(pointLabel({ dimensions: { metric: 'au_price' }, value: 4485.4, ts: 0 })).toBe('Au');
    expect(pointLabel({ dimensions: { metric: 'ag_1h_vol' }, value: 36.9, ts: 0 })).toBe(
      'Ag 1h Vol',
    );
    expect(pointLabel({ dimensions: { metric: 'xau_3m_dicor' }, value: 4.16, ts: 0 })).toBe(
      'Au 3M DICOR',
    );
  });

  it('uses compact labels for Karpathy jobs metrics', () => {
    expect(pointLabel({ dimensions: { metric: 'occupations' }, value: 342, ts: 0 })).toBe('Roles');
    expect(
      pointLabel({ dimensions: { metric: 'weighted_ai_exposure' }, value: '4.9 / 10', ts: 0 }),
    ).toBe('AI exposure');
  });
});
