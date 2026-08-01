export type ExecutionMode = 'public_cloud' | 'private_cloud' | 'user_side_runner';

export type SourceRightsStatus = 'public' | 'with-attribution' | 'requires-auth' | 'needs-review';

export type SourcePolicy = {
  readonly sourceId: string;
  readonly label: string;
  readonly sourceUrl: string;
  readonly rightsStatus: SourceRightsStatus;
  readonly executionMode: ExecutionMode;
  readonly publicDisplayEligible: boolean;
  readonly attribution: string;
  readonly reviewNotes: string;
  readonly lastReviewed: string;
};

const REVIEW_DATE = '2026-05-21';

const SOURCE_POLICIES: Readonly<Record<string, SourcePolicy>> = {
  'fx-pair': {
    sourceId: 'frankfurter-ecb',
    label: 'Frankfurter (ECB)',
    sourceUrl: 'https://www.frankfurter.app/',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Frankfurter, using European Central Bank reference rates',
    reviewNotes: 'Public no-key API for ECB reference rates.',
    lastReviewed: REVIEW_DATE,
  },
  'crypto-watchlist': {
    sourceId: 'coinbase-public',
    label: 'Coinbase',
    sourceUrl: 'https://www.coinbase.com/price',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Coinbase public price endpoints',
    reviewNotes: 'Public no-key spot price data; suitable for dogfood collections.',
    lastReviewed: REVIEW_DATE,
  },
  'crypto-history': {
    sourceId: 'coinbase-public',
    label: 'Coinbase',
    sourceUrl: 'https://www.coinbase.com/price',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Coinbase public price endpoints',
    reviewNotes: 'Public no-key spot price data; suitable for dogfood collections.',
    lastReviewed: REVIEW_DATE,
  },
  'market-history': {
    sourceId: 'yahoo-finance-chart',
    label: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Yahoo Finance',
    reviewNotes: 'Private dogfood stopgap for yearly charts; replace before public sharing.',
    lastReviewed: REVIEW_DATE,
  },
  'market-overview': {
    sourceId: 'stooq-yahoo-market-data',
    label: 'Stooq / Yahoo Finance',
    sourceUrl: 'https://stooq.com/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Stooq with Yahoo Finance fallback',
    reviewNotes:
      'Private dogfood market overview; Stooq is primary, Yahoo Finance is a fallback, so replace before public sharing.',
    lastReviewed: '2026-05-25',
  },
  'macro-market-history': {
    sourceId: 'free-macro-sources',
    label: 'Free macro sources',
    sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Configured public macro data source per preset',
    reviewNotes: 'No-key dogfood default; review each preset before public display.',
    lastReviewed: REVIEW_DATE,
  },
  'trading-economics-market': {
    sourceId: 'trading-economics',
    label: 'Trading Economics',
    sourceUrl: 'https://tradingeconomics.com/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Trading Economics',
    reviewNotes: 'Future keyed connector; keep as setup/future source until configured.',
    lastReviewed: REVIEW_DATE,
  },
  weather: {
    sourceId: 'open-meteo-weather',
    label: 'Open-Meteo',
    sourceUrl: 'https://open-meteo.com/',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Open-Meteo',
    reviewNotes: 'Public no-key weather forecast API.',
    lastReviewed: REVIEW_DATE,
  },
  airquality: {
    sourceId: 'open-meteo-air-quality',
    label: 'Open-Meteo Air Quality',
    sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Open-Meteo Air Quality',
    reviewNotes: 'Public no-key air quality API.',
    lastReviewed: REVIEW_DATE,
  },
  'equity-watchlist': {
    sourceId: 'stooq-yahoo-market-data',
    label: 'Stooq / Yahoo Finance',
    sourceUrl: 'https://stooq.com/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Stooq with Yahoo Finance fallback',
    reviewNotes:
      'Private dogfood watchlist quotes; Stooq is primary, Yahoo Finance is a fallback, so replace before public sharing.',
    lastReviewed: '2026-05-25',
  },
  'sector-movers': {
    sourceId: 'yahoo-finance-chart',
    label: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Yahoo Finance',
    reviewNotes:
      'Private dogfood snapshot of SPDR US sector ETF day-over-day moves; replace before public sharing.',
    lastReviewed: REVIEW_DATE,
  },
  'github-trending': {
    sourceId: 'github-trending',
    label: 'GitHub Trending',
    sourceUrl: 'https://github.com/trending',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'GitHub Trending',
    reviewNotes: 'HTML-derived snapshot; attribution required and public display needs review.',
    lastReviewed: REVIEW_DATE,
  },
  'github-repo-activity': {
    sourceId: 'github-api-public',
    label: 'GitHub',
    sourceUrl: 'https://github.com/',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'GitHub API',
    reviewNotes: 'Public repo API data.',
    lastReviewed: REVIEW_DATE,
  },
  'github-security-advisories': {
    sourceId: 'github-advisory-api',
    label: 'GitHub Security Advisories',
    sourceUrl: 'https://github.com/advisories',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'GitHub Advisory Database',
    reviewNotes:
      'Public GitHub Advisory Database REST API for reviewed security advisories; no key required for low-volume dogfood use.',
    lastReviewed: REVIEW_DATE,
  },
  'karpathy-jobs-snapshot': {
    sourceId: 'karpathy-jobs',
    label: 'Karpathy / BLS',
    sourceUrl: 'https://karpathy.ai/jobs/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'karpathy.ai/jobs and BLS',
    reviewNotes: 'Private dogfood signal; public display needs source-rights review.',
    lastReviewed: REVIEW_DATE,
  },
  'cisa-kev-recent': {
    sourceId: 'cisa-kev',
    label: 'CISA KEV',
    sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution:
      'Cybersecurity and Infrastructure Security Agency Known Exploited Vulnerabilities Catalog',
    reviewNotes:
      'CISA publishes the KEV catalog as a public machine-readable JSON feed for vulnerability management prioritization.',
    lastReviewed: REVIEW_DATE,
  },
  'cloudflare-incidents': {
    sourceId: 'cloudflare-status',
    label: 'Cloudflare Status',
    sourceUrl: 'https://www.cloudflarestatus.com/',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Cloudflare Status',
    reviewNotes:
      'Statuspage public JSON feed for current and recent Cloudflare incidents; no key required.',
    lastReviewed: REVIEW_DATE,
  },
  'uk-economic-calendar': {
    sourceId: 'bank-of-england-upcoming-events',
    label: 'Bank of England',
    sourceUrl: 'https://www.bankofengland.co.uk/events/upcoming-events',
    rightsStatus: 'public',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Bank of England upcoming events',
    reviewNotes:
      'Public Bank of England upcoming events page. Initial connector covers official upcoming key publications; ONS CPI/GDP/employment coverage remains a later source decision.',
    lastReviewed: REVIEW_DATE,
  },
  'manual-metric': {
    sourceId: 'manual-entry',
    label: 'Manual entry',
    sourceUrl: 'https://antenna.example/',
    rightsStatus: 'public',
    // Private-cloud mode keeps owner-entered values out of shared reads.
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'User-provided value',
    reviewNotes:
      'No upstream source; the private dispatcher materialises the owner-provided config value. Manual values are not public-display eligible.',
    lastReviewed: REVIEW_DATE,
  },
  'manual-cost': {
    sourceId: 'manual-cost-entry',
    label: 'Manual cost entry',
    sourceUrl: 'https://antenna.example/',
    rightsStatus: 'requires-auth',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'User-provided cost value',
    reviewNotes:
      'Private owner-entered operational spend. Manual values are not public-display eligible and contain no billing credentials.',
    lastReviewed: '2026-07-19',
  },
  'antenna-users': {
    sourceId: 'antenna-deployment',
    label: 'Antenna deployment',
    sourceUrl: 'https://antenna.example/',
    rightsStatus: 'requires-auth',
    // The Worker injects its own D1 aggregates at dispatch.
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'Own deployment metrics',
    reviewNotes:
      'Deployment-owner adoption counts read from D1. Aggregates only — no user identifiers reach a point — and never public-display eligible.',
    lastReviewed: '2026-07-25',
  },
  'rest-metric': {
    sourceId: 'generic-rest',
    label: 'Generic REST',
    sourceUrl: 'https://antenna.example/',
    rightsStatus: 'needs-review',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'User-provided endpoint',
    reviewNotes: 'Disabled for planner matching until allowlists and execution mode are enforced.',
    lastReviewed: REVIEW_DATE,
  },
  'app-usage': {
    sourceId: 'cloudflare-analytics-engine',
    label: 'Workers Analytics Engine',
    sourceUrl: 'https://developers.cloudflare.com/analytics/analytics-engine/',
    rightsStatus: 'requires-auth',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'Own product telemetry (Workers Analytics Engine)',
    reviewNotes:
      'Deployment-owner product usage events read via the authenticated SQL API; private-only by design.',
    lastReviewed: REVIEW_DATE,
  },
  'project-portfolio': {
    sourceId: 'cloudflare-analytics-engine-portfolio',
    label: 'Workers Analytics Engine',
    sourceUrl: 'https://developers.cloudflare.com/analytics/analytics-engine/',
    rightsStatus: 'requires-auth',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'Own product telemetry (Workers Analytics Engine)',
    reviewNotes:
      'Private aggregate of deployment-owner product events across explicitly configured projects.',
    lastReviewed: REVIEW_DATE,
  },
  'cloudflare-analytics': {
    sourceId: 'cloudflare-graphql-analytics',
    label: 'Cloudflare Analytics',
    sourceUrl: 'https://developers.cloudflare.com/analytics/graphql-api/',
    rightsStatus: 'requires-auth',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'Cloudflare GraphQL Analytics (Workers invocations)',
    reviewNotes:
      "Deployment owner's own Worker traffic read via the authenticated GraphQL API; private-only by design.",
    lastReviewed: REVIEW_DATE,
  },
  'cloudflare-web-analytics': {
    sourceId: 'cloudflare-web-analytics',
    label: 'Cloudflare Web Analytics',
    sourceUrl: 'https://developers.cloudflare.com/web-analytics/',
    rightsStatus: 'requires-auth',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'Cloudflare Web Analytics (privacy-first browser telemetry)',
    reviewNotes:
      "Deployment owner's aggregate browser visits read through the authenticated GraphQL API; private-only by design.",
    lastReviewed: '2026-08-01',
  },
  'app-health': {
    sourceId: 'deployment-health-endpoints',
    label: 'Production health endpoints',
    sourceUrl: 'https://antenna.example/',
    rightsStatus: 'requires-auth',
    executionMode: 'private_cloud',
    publicDisplayEligible: false,
    attribution: 'Deployment-owned public health endpoints',
    reviewNotes:
      'Private-only by design. The deployment manifest, never client config, grants fetch authority for each public HTTPS endpoint.',
    lastReviewed: '2026-08-01',
  },
  'aa-highlights': {
    sourceId: 'artificial-analysis-highlights',
    label: 'Artificial Analysis',
    sourceUrl: 'https://artificialanalysis.ai/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Artificial Analysis (artificialanalysis.ai)',
    reviewNotes:
      'Highlights extracted from schema.org Dataset JSON-LD embedded in the public homepage; attribution required, public display needs rights review.',
    lastReviewed: REVIEW_DATE,
  },
  'aa-frontier': {
    sourceId: 'artificial-analysis-frontier',
    label: 'Artificial Analysis',
    sourceUrl: 'https://artificialanalysis.ai/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Artificial Analysis (artificialanalysis.ai)',
    reviewNotes:
      'Joins intelligence, speed, and price fields from reviewed homepage JSON-LD; private display with attribution.',
    lastReviewed: REVIEW_DATE,
  },
  'tbench-leaderboard': {
    sourceId: 'tbench-ai-leaderboard',
    label: 'Terminal Bench',
    sourceUrl: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Terminal Bench (tbench.ai)',
    reviewNotes:
      'HTML-scraped leaderboard; public data but no JSON API — attribution required and public display needs review.',
    lastReviewed: '2026-08-01',
  },
};

export const sourcePolicyForTemplate = (templateId: string): SourcePolicy | undefined =>
  SOURCE_POLICIES[templateId];

export const sourceLabelForTemplate = (templateId: string, fallback: string): string =>
  sourcePolicyForTemplate(templateId)?.label ?? fallback;

export const publicDisplayBlockerForPolicy = (policy: SourcePolicy | undefined): string | null => {
  if (!policy) return 'Missing source policy.';
  if (!policy.publicDisplayEligible) return policy.reviewNotes;
  if (policy.executionMode === 'private_cloud') {
    return `${policy.label} is refreshed with private cloud credentials and cannot be shown publicly.`;
  }
  if (policy.executionMode === 'user_side_runner') {
    return `${policy.label} is user-side data; public-safe snapshot handling is not implemented yet.`;
  }
  if (policy.rightsStatus === 'requires-auth') {
    return `${policy.label} requires per-user authentication and cannot be shown publicly.`;
  }
  if (policy.rightsStatus === 'needs-review') {
    return `${policy.label} needs source-rights review before public display.`;
  }
  return null;
};

export const publicDisplayBlockerForTemplate = (templateId: string): string | null =>
  publicDisplayBlockerForPolicy(sourcePolicyForTemplate(templateId));
