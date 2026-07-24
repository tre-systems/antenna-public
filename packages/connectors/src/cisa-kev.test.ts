import { afterEach, describe, expect, it, vi } from 'vitest';
import { cisaKevRecent, normaliseKev, recentVulnerabilities } from './cisa-kev';

const body = {
  title: 'CISA Catalog of Known Exploited Vulnerabilities',
  vulnerabilities: [
    {
      cveID: 'CVE-2026-0003',
      vendorProject: 'Vendor C',
      product: 'Product C',
      vulnerabilityName: 'Vendor C Product C Code Execution Vulnerability',
      dateAdded: '2026-05-21',
      knownRansomwareCampaignUse: 'Known',
    },
    {
      cveID: 'CVE-2026-0002',
      vendorProject: 'Vendor B',
      product: 'Product B',
      vulnerabilityName: 'Vendor B Product B Injection Vulnerability',
      dateAdded: '2026-05-20',
      knownRansomwareCampaignUse: 'Unknown',
    },
    {
      cveID: 'CVE-2026-0001',
      vendorProject: 'Vendor A',
      product: 'Product A',
      vulnerabilityName: 'Vendor A Product A Vulnerability',
      dateAdded: '2026-05-19',
    },
    {
      cveID: 'CVE-2026-OLD',
      vendorProject: 'Old Vendor',
      product: 'Old Product',
      vulnerabilityName: 'Old Vulnerability',
      dateAdded: '2026-04-01',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('normaliseKev', () => {
  it('keeps valid CISA KEV rows and drops malformed entries', () => {
    expect(
      normaliseKev({ vulnerabilities: [...body.vulnerabilities, { cveID: 'broken' }] }),
    ).toHaveLength(4);
    expect(normaliseKev({}).length).toBe(0);
  });
});

describe('recentVulnerabilities', () => {
  it('filters and sorts by date added', () => {
    const now = Date.parse('2026-05-21T12:00:00Z');
    expect(recentVulnerabilities(normaliseKev(body), 7, now).map((entry) => entry.cveId)).toEqual([
      'CVE-2026-0003',
      'CVE-2026-0002',
      'CVE-2026-0001',
    ]);
  });
});

describe('cisaKevRecent', () => {
  it('returns a count plus ranked recent KEV entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await cisaKevRecent({ limit: 2 });

    expect(fetch).toHaveBeenCalledWith(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { headers: { Accept: 'application/json', 'User-Agent': 'antenna' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toMatchObject({
      dimensions: { source: 'cisa-kev', metric: 'recent_additions', days: 7 },
      value: 3,
      unit: 'CVEs',
      sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    });
    expect(result.points[1]).toMatchObject({
      dimensions: {
        source: 'cisa-kev',
        metric: 'recent_vulnerability',
        rank: 1,
        cve: 'CVE-2026-0003',
        vendor: 'Vendor C',
        product: 'Product C',
        date_added: '2026-05-21',
      },
      value: 'CVE-2026-0003 · Vendor C Product C',
      unit: 'ransomware: Known',
      sourceUrl:
        'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=CVE-2026-0003',
    });
    expect(result.rawPayload).toMatchObject({
      source: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      sourcePage: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      lookbackDays: 7,
    });
  });

  it('maps malformed payloads to parse_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const result = await cisaKevRecent({});
    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'no KEV entries parsed' },
    });
  });
});
