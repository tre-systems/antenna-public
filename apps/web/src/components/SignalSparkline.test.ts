import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import {
  changeColour,
  DEFAULT_SPARKLINE_RANGE,
  filterSeriesForRange,
  pointTimestamp,
  spanLabelFor,
  sparklinePath,
} from './SignalSparkline';
import { SparklineFigure } from './signal-sparkline/SparklineFigure';
import { SparklinePresentationFigure } from './signal-sparkline/SparklinePresentationFigure';

describe('sparklinePath', () => {
  it('builds an SVG path from timestamped values', () => {
    const path = sparklinePath([
      { ts: 1000, value: 10 },
      { ts: 2000, value: 15 },
      { ts: 3000, value: 12 },
    ]);

    expect(path).toMatch(/^M/);
    expect(path.split(' L')).toHaveLength(3);
  });

  it('handles a flat series without NaN coordinates', () => {
    const path = sparklinePath([
      { ts: 1000, value: 10 },
      { ts: 2000, value: 10 },
    ]);

    expect(path).not.toContain('NaN');
  });
});

describe('spanLabelFor', () => {
  const ts = (days: number): number => Date.UTC(2026, 0, 1) + days * 86_400_000;

  it('falls back to "Recent" when too few points to span anything', () => {
    expect(spanLabelFor([])).toBe('Recent');
    expect(spanLabelFor([{ ts: ts(0), value: 1 }])).toBe('Recent');
  });

  it('labels honestly by actual data span', () => {
    const range = (days: number) => [
      { ts: ts(0), value: 1 },
      { ts: ts(days), value: 1 },
    ];
    expect(spanLabelFor(range(0.5))).toBe('Today');
    expect(spanLabelFor(range(1))).toBe('1d');
    expect(spanLabelFor(range(3))).toBe('3d');
    expect(spanLabelFor(range(10))).toBe('7d');
    expect(spanLabelFor(range(30))).toBe('30d');
    expect(spanLabelFor(range(90))).toBe('3m');
    expect(spanLabelFor(range(365))).toBe('1Y');
  });
});

describe('filterSeriesForRange', () => {
  const ts = (days: number): number => Date.UTC(2026, 0, 1) + days * 86_400_000;
  const series = Array.from({ length: 366 }, (_, day) => ({ ts: ts(day), value: day }));

  it('defaults the visible data model to a one-year window', () => {
    const filtered = filterSeriesForRange(series, DEFAULT_SPARKLINE_RANGE);

    expect(filtered[0]?.ts).toBe(ts(0));
    expect(filtered.at(-1)?.ts).toBe(ts(365));
  });

  it('supports one-month and one-year views from the same fetched history', () => {
    expect(filterSeriesForRange(series, '1m')[0]?.ts).toBeGreaterThanOrEqual(ts(335));
    expect(filterSeriesForRange(series, '1y')).toHaveLength(366);
  });

  it('keeps a fallback pair when the requested window is sparse', () => {
    const sparse = [
      { ts: ts(0), value: 1 },
      { ts: ts(60), value: 2 },
    ];

    expect(filterSeriesForRange(sparse, '1w')).toEqual(sparse);
  });
});

describe('SparklineFigure', () => {
  const ts = (days: number): number => Date.UTC(2026, 0, 1) + days * 86_400_000;

  it('renders the one-year range as the default selected view', () => {
    const html = renderToString(
      h(SparklineFigure, {
        label: 'GBP/USD',
        points: [
          { ts: ts(0), value: 1 },
          { ts: ts(30), value: 1.2 },
          { ts: ts(365), value: 1.3 },
        ],
      }),
    );

    expect(html).toContain('GBP/USD · 1Y');
    expect(html).toContain('data-testid="sparkline-range-1w"');
    expect(html).toContain('data-testid="sparkline-range-1m"');
    expect(html).toContain('data-testid="sparkline-range-1y"');
    expect(html).toMatch(/aria-pressed="true"[\s\S]*?1Y/);
  });
});

describe('SparklinePresentationFigure', () => {
  const ts = (days: number): number => Date.UTC(2026, 0, 1) + days * 86_400_000;

  it('renders a large one-year trend without range controls', () => {
    const html = renderToString(
      h(SparklinePresentationFigure, {
        label: 'BTC',
        points: [
          { ts: ts(0), value: 100 },
          { ts: ts(365), value: 125 },
        ],
      }),
    );

    expect(html).toContain('data-testid="sparkline-presentation"');
    expect(html).toContain('1Y trend');
    expect(html).toContain('Up +25.0%');
    expect(html).not.toContain('data-testid="sparkline-range-1w"');
  });
});

describe('pointTimestamp', () => {
  it('prefers observed_at and keeps fetched_at as a compatibility fallback', () => {
    expect(
      pointTimestamp({
        metric_key: 'close',
        value: 10,
        observed_at: 2000,
        fetched_at: 1000,
        dimensions: null,
      }),
    ).toBe(2000);
    expect(
      pointTimestamp({
        metric_key: 'close',
        value: 10,
        fetched_at: 1000,
        dimensions: null,
      } as Parameters<typeof pointTimestamp>[0]),
    ).toBe(1000);
  });
});

describe('changeColour', () => {
  it('returns null when no change has been computed yet', () => {
    expect(changeColour(null)).toBeNull();
  });

  it('renders a flat (rounds-to-zero) change as slate "0.0%", not red "-0.0%"', () => {
    const result = changeColour(-0.04);
    expect(result?.label).toBe('0.0%');
    expect(result?.colour).toContain('slate');
  });

  it('renders positive changes with a leading "+" in emerald', () => {
    const result = changeColour(7.23);
    expect(result?.label).toBe('+7.2%');
    expect(result?.colour).toContain('emerald');
  });

  it('renders negative changes with a leading "-" in rose', () => {
    const result = changeColour(-28.16);
    expect(result?.label).toBe('-28.2%');
    expect(result?.colour).toContain('rose');
  });
});
