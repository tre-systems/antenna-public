import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult, DataPoint } from './types';

type CisaKevConfig = {
  readonly sourceUrl?: string;
  readonly lookbackDays?: number;
  readonly limit?: number;
};

type CisaKevVulnerability = {
  readonly cveID?: unknown;
  readonly vendorProject?: unknown;
  readonly product?: unknown;
  readonly vulnerabilityName?: unknown;
  readonly dateAdded?: unknown;
  readonly knownRansomwareCampaignUse?: unknown;
};

type CisaKevResponse = {
  readonly vulnerabilities?: unknown;
};

const DEFAULT_SOURCE =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const SOURCE_PAGE = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';
const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_LIMIT = 3;

export const cisaKevRecent: Adapter<CisaKevConfig> = async (config): Promise<AdapterResult> => {
  const sourceUrl = stringValue(config.sourceUrl) ?? DEFAULT_SOURCE;
  const fetched = await fetchJson(sourceUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'antenna' },
  });
  if (!fetched.ok) return fetched;

  const vulnerabilities = normaliseKev(fetched.body);
  if (vulnerabilities.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no KEV entries parsed' } };
  }

  const lookbackDays = positiveInt(config.lookbackDays) ?? DEFAULT_LOOKBACK_DAYS;
  const limit = positiveInt(config.limit) ?? DEFAULT_LIMIT;
  const now = Date.now();
  const recent = recentVulnerabilities(vulnerabilities, lookbackDays, now);

  return {
    ok: true,
    points: [
      {
        dimensions: { source: 'cisa-kev', metric: 'recent_additions', days: lookbackDays },
        value: recent.length,
        unit: 'CVEs',
        ts: now,
        sourceUrl: SOURCE_PAGE,
      },
      ...recent.slice(0, limit).map((entry, index) => toEntryPoint(entry, index + 1, now)),
    ],
    rawPayload: { source: sourceUrl, sourcePage: SOURCE_PAGE, lookbackDays, recent },
  };
};

type NormalisedKev = {
  readonly cveId: string;
  readonly vendor: string;
  readonly product: string;
  readonly name: string;
  readonly dateAdded: string;
  readonly dateAddedMs: number;
  readonly ransomwareUse?: string;
};

export const normaliseKev = (body: unknown): NormalisedKev[] => {
  if (!body || typeof body !== 'object') return [];
  const rows = (body as CisaKevResponse).vulnerabilities;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const entry = row as CisaKevVulnerability;
    const cveId = stringValue(entry.cveID);
    const vendor = stringValue(entry.vendorProject);
    const product = stringValue(entry.product);
    const name = stringValue(entry.vulnerabilityName);
    const dateAdded = stringValue(entry.dateAdded);
    const dateAddedMs = dateAdded ? Date.parse(`${dateAdded}T00:00:00Z`) : NaN;
    if (!cveId || !vendor || !product || !name || !dateAdded || !Number.isFinite(dateAddedMs)) {
      return [];
    }
    const ransomwareUse = stringValue(entry.knownRansomwareCampaignUse);
    return [
      {
        cveId,
        vendor,
        product,
        name,
        dateAdded,
        dateAddedMs,
        ...(ransomwareUse ? { ransomwareUse } : {}),
      },
    ];
  });
};

export const recentVulnerabilities = (
  entries: readonly NormalisedKev[],
  lookbackDays: number,
  now: number,
): NormalisedKev[] => {
  const since = now - lookbackDays * 86_400_000;
  return entries
    .filter((entry) => entry.dateAddedMs >= since && entry.dateAddedMs <= now)
    .sort((a, b) => b.dateAddedMs - a.dateAddedMs || a.cveId.localeCompare(b.cveId));
};

const toEntryPoint = (entry: NormalisedKev, rank: number, ts: number): DataPoint => ({
  dimensions: {
    source: 'cisa-kev',
    metric: 'recent_vulnerability',
    rank,
    cve: entry.cveId,
    vendor: entry.vendor,
    product: entry.product,
    date_added: entry.dateAdded,
  },
  value: `${entry.cveId} · ${entry.vendor} ${entry.product}`,
  unit: entry.ransomwareUse ? `ransomware: ${entry.ransomwareUse}` : undefined,
  ts,
  sourceUrl: `${SOURCE_PAGE}?search_api_fulltext=${encodeURIComponent(entry.cveId)}`,
});

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const positiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
