import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeIncidents,
  cloudflareIncidents,
  normaliseCloudflareIncidents,
  recentIncidents,
} from './cloudflare-incidents';

const body = {
  incidents: [
    {
      id: 'active-major',
      name: 'Workers KV elevated errors',
      status: 'investigating',
      impact: 'major',
      created_at: '2026-05-21T10:00:00.000Z',
      updated_at: '2026-05-21T10:05:00.000Z',
      started_at: '2026-05-21T09:58:00.000Z',
      shortlink: 'https://stspg.io/active-major',
      components: [{ name: 'Workers KV' }, { name: 'Workers' }],
    },
    {
      id: 'recent-minor',
      name: 'D1 query latency',
      status: 'resolved',
      impact: 'minor',
      created_at: '2026-05-21T09:00:00.000Z',
      updated_at: '2026-05-21T09:30:00.000Z',
      resolved_at: '2026-05-21T09:30:00.000Z',
      shortlink: 'https://stspg.io/recent-minor',
      components: [{ name: 'D1' }],
    },
    {
      id: 'old',
      name: 'Old regional issue',
      status: 'resolved',
      impact: 'none',
      created_at: '2026-05-19T09:00:00.000Z',
      updated_at: '2026-05-19T09:30:00.000Z',
      components: [],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('normaliseCloudflareIncidents', () => {
  it('keeps valid Statuspage incidents and drops malformed rows', () => {
    const rows = normaliseCloudflareIncidents({ incidents: [...body.incidents, { id: 'broken' }] });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: 'active-major',
      name: 'Workers KV elevated errors',
      status: 'investigating',
      impact: 'major',
      components: ['Workers KV', 'Workers'],
    });
    expect(normaliseCloudflareIncidents({})).toEqual([]);
  });
});

describe('activeIncidents', () => {
  it('returns unresolved incidents sorted by severity', () => {
    expect(
      activeIncidents(normaliseCloudflareIncidents(body)).map((incident) => incident.id),
    ).toEqual(['active-major']);
  });
});

describe('recentIncidents', () => {
  it('filters by created timestamp and sorts latest first', () => {
    const now = Date.parse('2026-05-21T10:15:00.000Z');

    expect(
      recentIncidents(normaliseCloudflareIncidents(body), 24, now).map((incident) => incident.id),
    ).toEqual(['active-major', 'recent-minor']);
  });
});

describe('cloudflareIncidents', () => {
  it('returns active and recent incident summary points', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T10:15:00.000Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await cloudflareIncidents({ limit: 2 });

    expect(fetch).toHaveBeenCalledWith('https://www.cloudflarestatus.com/api/v2/incidents.json', {
      headers: { Accept: 'application/json', 'User-Agent': 'antenna' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(4);
    expect(result.points[0]).toMatchObject({
      dimensions: { source: 'cloudflare-status', metric: 'active_incidents' },
      value: 1,
      unit: 'incidents',
      sourceUrl: 'https://www.cloudflarestatus.com/',
    });
    expect(result.points[1]).toMatchObject({
      dimensions: { source: 'cloudflare-status', metric: 'recent_incidents', hours: 24 },
      value: 2,
      unit: 'incidents',
    });
    expect(result.points[2]).toMatchObject({
      dimensions: {
        source: 'cloudflare-status',
        metric: 'incident',
        rank: 1,
        status: 'investigating',
        impact: 'major',
        incident_id: 'active-major',
        components: 'Workers KV, Workers',
      },
      value: 'Workers KV elevated errors',
      unit: 'investigating',
      sourceUrl: 'https://stspg.io/active-major',
    });
    expect(result.rawPayload).toMatchObject({
      source: 'https://www.cloudflarestatus.com/api/v2/incidents.json',
      sourcePage: 'https://www.cloudflarestatus.com/',
      lookbackHours: 24,
    });
  });

  it('maps malformed payloads to parse_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const result = await cloudflareIncidents({});
    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'no Cloudflare incidents parsed' },
    });
  });
});
