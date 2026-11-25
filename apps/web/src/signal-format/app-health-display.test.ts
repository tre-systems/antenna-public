import { describe, expect, it } from 'vitest';
import { compactRowsCardData } from './compact-rows';
import { makeSignal } from './test-support';

const point = (state: string, status: number, rank = 1) => ({
  dimensions: {
    metric: 'app_health',
    project: 'sample-app',
    state,
    http_status: status,
    latency_ms: 42,
    rank,
  },
  value: state === 'healthy' ? 1 : 0,
});
const card = (...points: ReturnType<typeof point>[]) =>
  compactRowsCardData(makeSignal({ template_id: 'app-health', points }));

describe('health observation presentation', () => {
  it.each(['probe_error', 'down'])(
    'does not present an HTTP-0 %s as confirmed downtime',
    (state) => {
      expect(card(point(state, 0))).toMatchObject({
        summary: '1 unknown',
        rows: [
          {
            chip: 'probe error',
            chipTone: 'warn',
            subtitle: 'Probe failed · availability unknown',
          },
        ],
      });
    },
  );

  it('keeps genuine downtime visible alongside unavailable probes', () => {
    const result = card(point('down', 503), point('probe_error', 0, 2));
    expect(result?.summary).toBe('1 down · 1 unknown');
    expect(result?.rows[0]).toMatchObject({
      chip: 'down',
      chipTone: 'urgent',
      subtitle: 'HTTP 503 · 42 ms',
    });
  });

  it('makes an unapproved redirect and missing configuration unknown rather than healthy', () => {
    const result = card(point('redirect', 307), point('unconfigured', 0, 2));
    expect(result?.summary).toBe('2 unknown');
    expect(result?.rows[0]).toMatchObject({
      chip: 'redirect',
      chipTone: 'warn',
      subtitle: 'HTTP 307 · redirect not followed',
    });
    expect(result?.rows[1]?.subtitle).toBe('No server-approved endpoint');
  });

  it('only claims full health when every application response is healthy', () => {
    expect(card(point('healthy', 200), point('healthy', 200, 2))?.summary).toBe('2/2 healthy');
    expect(card(point('degraded', 200), point('probe_error', 0, 2))?.summary).toBe(
      '1 degraded · 1 unknown',
    );
  });
});
