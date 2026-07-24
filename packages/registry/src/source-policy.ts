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
const PUBLICATION_REVIEW_DATE = '2026-07-24';

const SOURCE_POLICIES = {
  'fx-pair': {
    sourceId: 'frankfurter-ecb',
    label: 'Frankfurter (ECB)',
    sourceUrl: 'https://frankfurter.dev/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Frankfurter, using European Central Bank reference rates',
    reviewNotes:
      'Frankfurter documents its public API as free for commercial use; retain Frankfurter and underlying provider attribution.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'crypto-watchlist': {
    sourceId: 'coinbase-public',
    label: 'Coinbase',
    sourceUrl: 'https://www.coinbase.com/price',
    rightsStatus: 'needs-review',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Coinbase public price endpoints',
    reviewNotes:
      'Coinbase market-data terms restrict third-party redistribution and display without written consent.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'crypto-history': {
    sourceId: 'coinbase-public',
    label: 'Coinbase',
    sourceUrl: 'https://www.coinbase.com/price',
    rightsStatus: 'needs-review',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Coinbase public price endpoints',
    reviewNotes:
      'Coinbase market-data terms restrict third-party redistribution and display without written consent.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'market-history': {
    sourceId: 'yahoo-finance-chart',
    label: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Yahoo Finance',
    reviewNotes: 'Private-only stopgap for yearly charts; replace before public sharing.',
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
      'Private-only market overview; Stooq is primary, Yahoo Finance is a fallback, so replace before public sharing.',
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
    reviewNotes: 'No-key private default; review each preset before public display.',
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
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Open-Meteo',
    reviewNotes:
      'Open-Meteo API data is CC BY 4.0; display must link and credit Open-Meteo. The free hosted endpoint is non-commercial.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  airquality: {
    sourceId: 'open-meteo-air-quality',
    label: 'Open-Meteo Air Quality',
    sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'Open-Meteo Air Quality',
    reviewNotes:
      'Open-Meteo API data is CC BY 4.0; display must link and credit Open-Meteo. The free hosted endpoint is non-commercial.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
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
      'Private-only watchlist quotes; Stooq is primary, Yahoo Finance is a fallback, so replace before public sharing.',
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
      'Private-only snapshot of SPDR US sector ETF day-over-day moves; replace before public sharing.',
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
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'GitHub API',
    reviewNotes:
      'Public repository facts read through the GitHub API; retain a link to the repository and comply with GitHub API terms.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'github-security-advisories': {
    sourceId: 'github-advisory-api',
    label: 'GitHub Security Advisories',
    sourceUrl: 'https://github.com/advisories',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: true,
    attribution: 'GitHub Advisory Database',
    reviewNotes:
      'Public GitHub Advisory Database REST API for reviewed security advisories; no key required for low-volume use.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'karpathy-jobs-snapshot': {
    sourceId: 'karpathy-jobs',
    label: 'Karpathy / BLS',
    sourceUrl: 'https://karpathy.ai/jobs/',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'karpathy.ai/jobs and BLS',
    reviewNotes: 'Private-only signal; public display needs source-rights review.',
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
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'cloudflare-incidents': {
    sourceId: 'cloudflare-status',
    label: 'Cloudflare Status',
    sourceUrl: 'https://www.cloudflarestatus.com/',
    rightsStatus: 'needs-review',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Cloudflare Status',
    reviewNotes:
      'The public Statuspage API is suitable for private monitoring; third-party public display terms need explicit review.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'uk-economic-calendar': {
    sourceId: 'bank-of-england-upcoming-events',
    label: 'Bank of England',
    sourceUrl: 'https://www.bankofengland.co.uk/events/upcoming-events',
    rightsStatus: 'needs-review',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Bank of England upcoming events',
    reviewNotes:
      'Bank of England database data can use the Open Government Licence, but this connector reads the upcoming-events page; public reuse needs a page-specific review.',
    lastReviewed: PUBLICATION_REVIEW_DATE,
  },
  'manual-metric': {
    sourceId: 'manual-entry',
    label: 'Manual entry',
    sourceUrl: 'https://antenna.example/',
    rightsStatus: 'public',
    // The adapter performs no network access: it materialises the value already
    // stored in the owner's private signal config. Treating that as private
    // cloud execution lets the normal dispatcher create a point and healthy
    // status without widening who may read the value.
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
    sourceUrl: 'https://www.tbench.ai/leaderboard/terminal-bench/2.0',
    rightsStatus: 'with-attribution',
    executionMode: 'public_cloud',
    publicDisplayEligible: false,
    attribution: 'Terminal Bench (tbench.ai)',
    reviewNotes:
      'HTML-scraped leaderboard; public data but no JSON API — attribution required and public display needs review.',
    lastReviewed: '2026-05-22',
  },
} satisfies Record<string, SourcePolicy>;

const SOURCE_POLICY_BY_TEMPLATE: Readonly<Record<string, SourcePolicy>> = SOURCE_POLICIES;

export const sourcePolicyForTemplate = (templateId: string): SourcePolicy | undefined =>
  SOURCE_POLICY_BY_TEMPLATE[templateId];

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
