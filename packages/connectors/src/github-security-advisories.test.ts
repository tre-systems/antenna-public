import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  githubSecurityAdvisories,
  normaliseGithubSecurityAdvisories,
  recentAdvisories,
} from './github-security-advisories';

const criticalBody = [
  {
    ghsa_id: 'GHSA-critical',
    cve_id: 'CVE-2026-0001',
    html_url: 'https://github.com/advisories/GHSA-critical',
    summary: 'Critical npm package compromise',
    severity: 'critical',
    published_at: '2026-05-21T09:00:00Z',
    updated_at: '2026-05-21T09:30:00Z',
    vulnerabilities: [
      { package: { ecosystem: 'npm', name: '@scope/critical' } },
      { package: { ecosystem: 'npm', name: 'critical-helper' } },
    ],
  },
];

const highBody = [
  {
    ghsa_id: 'GHSA-high',
    html_url: 'https://github.com/advisories/GHSA-high',
    summary: 'High severity prototype pollution',
    severity: 'high',
    published_at: '2026-05-20T09:00:00Z',
    updated_at: '2026-05-20T09:30:00Z',
    vulnerabilities: [{ package: { ecosystem: 'npm', name: 'vulnerable-lib' } }],
  },
  {
    ghsa_id: 'GHSA-old',
    html_url: 'https://github.com/advisories/GHSA-old',
    summary: 'Older high severity issue',
    severity: 'high',
    published_at: '2026-04-01T09:00:00Z',
    vulnerabilities: [{ package: { ecosystem: 'npm', name: 'old-lib' } }],
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('normaliseGithubSecurityAdvisories', () => {
  it('keeps valid advisories and drops malformed rows', () => {
    const rows = normaliseGithubSecurityAdvisories([...criticalBody, { ghsa_id: 'broken' }]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ghsaId: 'GHSA-critical',
      cveId: 'CVE-2026-0001',
      summary: 'Critical npm package compromise',
      severity: 'critical',
      packages: ['@scope/critical', 'critical-helper'],
    });
    expect(normaliseGithubSecurityAdvisories({})).toEqual([]);
  });
});

describe('recentAdvisories', () => {
  it('filters by published timestamp and sorts critical before high', () => {
    const now = Date.parse('2026-05-21T12:00:00Z');
    const advisories = normaliseGithubSecurityAdvisories([...highBody, ...criticalBody]);

    expect(recentAdvisories(advisories, 7, now).map((advisory) => advisory.ghsaId)).toEqual([
      'GHSA-critical',
      'GHSA-high',
    ]);
  });
});

describe('githubSecurityAdvisories', () => {
  it('returns count and ranked advisory points for recent npm high/critical advisories', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(criticalBody), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(highBody), { status: 200 })),
    );

    const result = await githubSecurityAdvisories({ ecosystem: 'npm', limit: 2 });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/advisories?ecosystem=npm&severity=critical&per_page=30',
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'antenna' },
      },
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/advisories?ecosystem=npm&severity=high&per_page=30',
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'antenna' },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(5);
    expect(result.points[0]).toMatchObject({
      dimensions: {
        source: 'github-advisory-api',
        ecosystem: 'npm',
        metric: 'recent_high_or_critical',
        days: 7,
      },
      value: 2,
      unit: 'advisories',
      sourceUrl: 'https://github.com/advisories',
    });
    expect(result.points[1]).toMatchObject({
      dimensions: {
        source: 'github-advisory-api',
        ecosystem: 'npm',
        metric: 'recent_by_severity',
        severity: 'critical',
        days: 7,
      },
      value: 1,
    });
    expect(result.points[3]).toMatchObject({
      dimensions: {
        source: 'github-advisory-api',
        ecosystem: 'npm',
        metric: 'advisory',
        rank: 1,
        severity: 'critical',
        ghsa: 'GHSA-critical',
        cve: 'CVE-2026-0001',
        packages: '@scope/critical, critical-helper',
      },
      value: 'CRITICAL · Critical npm package compromise',
      unit: '@scope/critical, critical-helper',
      sourceUrl: 'https://github.com/advisories/GHSA-critical',
    });
    expect(result.rawPayload).toMatchObject({
      source: 'https://api.github.com/advisories',
      sourcePage: 'https://github.com/advisories',
      ecosystem: 'npm',
      severities: ['critical', 'high'],
      lookbackDays: 7,
      fetched: 3,
    });
  });

  it('maps rate limits to retryable adapter errors', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T06:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('rate limit', {
          status: 403,
          headers: {
            'x-ratelimit-reset': String(Date.parse('2026-05-22T06:15:00Z') / 1000),
          },
        }),
      ),
    );

    const result = await githubSecurityAdvisories({});

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'GitHub advisory API rate limit',
        retryAfterSeconds: 900,
      },
    });
    vi.useRealTimers();
  });

  it('sends bearer auth when a GitHub token is configured', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await githubSecurityAdvisories({ githubToken: 'test-github-token' });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer test-github-token');
  });
});
