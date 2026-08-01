import { describe, expect, it } from 'vitest';
import { compactRowsCardData } from './compact-rows';
import { makeSignal } from './test-support';

describe('compactRowsCardData', () => {
  it('shapes cloudflare-incidents into ranked rows with status chips', () => {
    const signal = makeSignal({
      template_id: 'cloudflare-incidents',
      points: [
        {
          dimensions: { metric: 'incident', rank: '2', status: 'resolved', components: 'Workers' },
          value: null,
          value_text: 'Workers slow',
          source_url: 'https://stspg.io/x',
        },
        {
          dimensions: {
            metric: 'incident',
            rank: '1',
            status: 'investigating',
            components: 'Access',
          },
          value: null,
          value_text: 'Cloudflare Access delayed audit logs',
          source_url: 'https://stspg.io/y',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows.map((r) => r.title)).toEqual([
      'Cloudflare Access delayed audit logs',
      'Workers slow',
    ]);
    expect(out?.rows[0]?.chip).toBe('investigating');
    expect(out?.rows[0]?.chipTone).toBe('urgent');
    expect(out?.rows[1]?.chipTone).toBe('ok');
    expect(out?.summary).toBe('1 active');
  });

  it('strips the "CRITICAL · " prefix from GHSA rows because the chip already says CRITICAL', () => {
    const signal = makeSignal({
      template_id: 'github-security-advisories',
      points: [
        {
          dimensions: {
            metric: 'advisory',
            rank: '1',
            severity: 'critical',
            packages: '@cap-js/sqlite',
          },
          value: null,
          value_text: 'CRITICAL · Supply chain compromise via malicious versions',
          source_url: 'https://github.com/advisories/x',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows[0]?.title).toBe('Supply chain compromise via malicious versions');
    expect(out?.rows[0]?.chip).toBe('CRITICAL');
    expect(out?.rows[0]?.chipTone).toBe('urgent');
  });

  it('formats UK BoE publications as relative-time chips ("in 4w")', () => {
    const signal = makeSignal({
      template_id: 'uk-economic-calendar',
      points: [
        {
          dimensions: { metric: 'publication', rank: '1', date: '2026-06-18', days_until: '28' },
          value: null,
          value_text: 'Monetary Policy Summary and minutes',
          source_url: 'https://www.bankofengland.co.uk/x',
        },
      ],
    });
    const row = compactRowsCardData(signal)?.rows[0];
    expect(row?.title).toBe('Monetary Policy Summary and minutes');
    expect(row?.subtitle).toBe('2026-06-18');
    expect(row?.chip).toBe('in 4w');
  });

  it('tones UK BoE countdown chips by urgency (tomorrow=urgent, 5d=warn, 21d=ok)', () => {
    const signal = makeSignal({
      template_id: 'uk-economic-calendar',
      points: [
        {
          dimensions: { metric: 'publication', rank: '1', date: '2026-05-23', days_until: '1' },
          value: null,
          value_text: 'Monetary Policy Summary',
          source_url: 'https://www.bankofengland.co.uk/a',
        },
        {
          dimensions: { metric: 'publication', rank: '2', date: '2026-05-27', days_until: '5' },
          value: null,
          value_text: 'Financial Stability Report',
          source_url: 'https://www.bankofengland.co.uk/b',
        },
        {
          dimensions: { metric: 'publication', rank: '3', date: '2026-06-12', days_until: '21' },
          value: null,
          value_text: 'Bank Rate decision',
          source_url: 'https://www.bankofengland.co.uk/c',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.summary).toBe('Next 3 events');
    expect(out?.rows.map((r) => r.chip)).toEqual(['tomorrow', 'in 5d', 'in 3w']);
    expect(out?.rows.map((r) => r.chipTone)).toEqual(['urgent', 'warn', 'ok']);
    expect(out?.rows.map((r) => r.title)).toEqual([
      'Monetary Policy Summary',
      'Financial Stability Report',
      'Bank Rate decision',
    ]);
  });

  it('returns null for templates without ranked incident-shaped data', () => {
    expect(compactRowsCardData(makeSignal({ template_id: 'fx-pair' }))).toBeNull();
    expect(compactRowsCardData(makeSignal({ template_id: 'weather' }))).toBeNull();
  });

  it('orders project activity by event count and summarises the portfolio', () => {
    const signal = makeSignal({
      template_id: 'project-portfolio',
      points: [
        {
          dimensions: {
            metric: 'project_activity',
            rank: 1,
            project: 'second-app',
            previous: 0,
            change: 0,
            top_event: '',
          },
          value: 0,
          unit: 'events',
        },
        {
          dimensions: {
            metric: 'project_activity',
            rank: 2,
            project: 'example-app',
            previous: 5,
            change: 100,
            top_event: 'page_view',
          },
          value: 10,
          unit: 'events',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.summary).toBe('10 product events · 1/2 active');
    expect(out?.rows[0]).toMatchObject({
      title: 'Example App',
      subtitle: '+100% vs prior · page view',
      chip: '10 events',
    });
    expect(out?.rows[1]).toMatchObject({ title: 'Second App', subtitle: 'quiet' });
  });

  it('renders app health failures and real-browser telemetry gaps explicitly', () => {
    const health = compactRowsCardData(
      makeSignal({
        template_id: 'app-health',
        points: [
          {
            dimensions: {
              metric: 'app_health',
              rank: 1,
              project: 'down-app',
              state: 'down',
              http_status: 503,
              latency_ms: 240,
            },
            value: 0,
            source_url: 'https://down.example/health',
          },
          {
            dimensions: {
              metric: 'app_health',
              rank: 2,
              project: 'acto',
              state: 'healthy',
              http_status: 200,
              latency_ms: 42,
            },
            value: 1,
          },
        ],
      }),
    );
    expect(health?.summary).toBe('1 down');
    expect(health?.rows[0]).toMatchObject({
      title: 'Down App',
      subtitle: 'HTTP 503 · 240 ms',
      chip: 'down',
      chipTone: 'urgent',
    });

    const visits = compactRowsCardData(
      makeSignal({
        template_id: 'cloudflare-web-analytics',
        points: [
          {
            dimensions: {
              metric: 'host_traffic',
              rank: 1,
              host: 'example.com',
              previous: 50,
              change: 20,
              telemetry_state: 'active',
            },
            value: 60,
          },
          {
            dimensions: {
              metric: 'host_traffic',
              rank: 2,
              host: 'missing.example',
              previous: 0,
              change: 0,
              telemetry_state: 'unseen',
            },
            value: 0,
          },
        ],
      }),
    );
    expect(visits?.summary).toBe('60 visits · 1/2 active · 1 unseen');
    expect(visits?.rows[1]).toMatchObject({
      subtitle: 'telemetry unseen',
      chipTone: 'warn',
    });
  });
});
