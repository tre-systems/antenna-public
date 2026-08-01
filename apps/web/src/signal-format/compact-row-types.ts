export type CompactRow = {
  readonly rank: number;
  readonly title: string;
  readonly subtitle: string | null;
  readonly chip: string | null;
  readonly chipTone: 'urgent' | 'warn' | 'info' | 'muted' | 'ok';
  readonly href: string | null;
};

export type CompactRowsCardData = {
  readonly summary: string | null;
  readonly rows: ReadonlyArray<CompactRow>;
};

const COMPACT_ROW_TEMPLATES = new Set([
  'cloudflare-incidents',
  'github-security-advisories',
  'cisa-kev-recent',
  'uk-economic-calendar',
  'sector-movers',
  'tbench-leaderboard',
  'aa-highlights',
  'aa-frontier',
  'project-portfolio',
  'app-health',
  'cloudflare-web-analytics',
  'karpathy-jobs-snapshot',
  'market-overview',
]);

const ROW_METRICS: Readonly<Record<string, ReadonlySet<string>>> = {
  'cloudflare-incidents': new Set(['incident']),
  'github-security-advisories': new Set(['advisory']),
  'cisa-kev-recent': new Set(['recent_vulnerability']),
  'uk-economic-calendar': new Set(['publication']),
  'sector-movers': new Set(['sector_change']),
  'tbench-leaderboard': new Set(['leaderboard_entry']),
  'aa-highlights': new Set(['aa_intelligence', 'aa_speed', 'aa_price']),
  'aa-frontier': new Set(['aa_frontier']),
  'project-portfolio': new Set(['project_activity']),
  'app-health': new Set(['app_health']),
  'cloudflare-web-analytics': new Set(['host_traffic']),
  'karpathy-jobs-snapshot': new Set(['top_role']),
  'market-overview': new Set(['market_proxy_change']),
};

const COMPACT_ROW_LIMIT_DEFAULT = 3;

export const isCompactRowsTemplate = (template: string): boolean =>
  COMPACT_ROW_TEMPLATES.has(template);

export const compactRowLimit = (template: string): number => {
  if (template === 'sector-movers') return 11;
  if (template === 'tbench-leaderboard') return 10;
  if (template === 'karpathy-jobs-snapshot') return 3;
  if (template === 'market-overview') return 10;
  if (template === 'project-portfolio') return 20;
  if (template === 'app-health' || template === 'cloudflare-web-analytics') return 30;
  if (template === 'aa-frontier') return 10;
  return COMPACT_ROW_LIMIT_DEFAULT;
};

export const isRowMetric = (metric: unknown, template: string): boolean => {
  if (typeof metric !== 'string') return false;
  return ROW_METRICS[template]?.has(metric) ?? false;
};
