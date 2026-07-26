import { fxPairTemplate } from './fx-pair';
import { cryptoWatchlistTemplate } from './crypto-watchlist';
import { cryptoHistoryTemplate } from './crypto-history';
import { weatherTemplate } from './weather';
import { airQualityTemplate } from './airquality';
import { equityWatchlistTemplate } from './equity-watchlist';
import { marketHistoryTemplate } from './market-history';
import { marketOverviewTemplate } from './market-overview';
import { sectorMoversTemplate } from './sector-movers';
import { macroMarketHistoryTemplate } from './macro-market-history';
import { tradingEconomicsMarketTemplate } from './trading-economics-market';
import { githubTrendingTemplate } from './github-trending';
import { githubRepoActivityTemplate } from './github-repo-activity';
import { karpathyJobsSnapshotTemplate } from './karpathy-jobs-snapshot';
import { manualMetricTemplate } from './manual-metric';
import { manualCostTemplate } from './manual-cost';
import { restMetricTemplate } from './rest-metric';
import { cisaKevRecentTemplate } from './cisa-kev-recent';
import { cloudflareIncidentsTemplate } from './cloudflare-incidents';
import { githubSecurityAdvisoriesTemplate } from './github-security-advisories';
import { aaHighlightsTemplate } from './aa-highlights';
import { aaFrontierTemplate } from './aa-frontier';
import { tbenchLeaderboardTemplate } from './tbench-leaderboard';
import { ukEconomicCalendarTemplate } from './uk-economic-calendar';
import { appUsageTemplate } from './app-usage';
import { cloudflareAnalyticsTemplate } from './cloudflare-analytics';
import { projectPortfolioTemplate } from './project-portfolio';
import { redditProblemsTemplate } from './reddit-problems';
import { antennaUsersTemplate } from './antenna-users';

export type {
  AlertRule,
  AlertRuleInput,
  ConnectorTemplate,
  CollectionTemplate,
  CollectionTemplateSignalSpec,
} from './types';
export type { ExecutionMode, SourcePolicy, SourceRightsStatus } from './source-policy';
export {
  publicDisplayBlockerForPolicy,
  publicDisplayBlockerForTemplate,
  sourceLabelForTemplate,
  sourcePolicyForTemplate,
} from './source-policy';
export {
  resolvePointDisplay,
  resolveTemplateDisplay,
  type RegistryDisplay,
  type RegistryPointDisplay,
  type RegistryPointInput,
} from './display';
export { safeExternalUrl } from './safe-url';
export { collectionTemplates } from './collection-templates';

export const templates = [
  fxPairTemplate,
  cryptoHistoryTemplate,
  cryptoWatchlistTemplate,
  macroMarketHistoryTemplate,
  marketHistoryTemplate,
  marketOverviewTemplate,
  tradingEconomicsMarketTemplate,
  weatherTemplate,
  airQualityTemplate,
  equityWatchlistTemplate,
  sectorMoversTemplate,
  githubTrendingTemplate,
  githubRepoActivityTemplate,
  karpathyJobsSnapshotTemplate,
  manualCostTemplate,
  manualMetricTemplate,
  antennaUsersTemplate,
  restMetricTemplate,
  ukEconomicCalendarTemplate,
  cisaKevRecentTemplate,
  githubSecurityAdvisoriesTemplate,
  cloudflareIncidentsTemplate,
  tbenchLeaderboardTemplate,
  aaHighlightsTemplate,
  aaFrontierTemplate,
  appUsageTemplate,
  cloudflareAnalyticsTemplate,
  projectPortfolioTemplate,
  redditProblemsTemplate,
] as const;
