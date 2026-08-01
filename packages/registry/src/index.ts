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
import { appHealthTemplate } from './app-health';
import { cloudflareWebAnalyticsTemplate } from './cloudflare-web-analytics';
import { antennaUsersTemplate } from './antenna-users';

export { aaFrontierTemplate } from './aa-frontier';
export { aaHighlightsTemplate } from './aa-highlights';
export { airQualityTemplate } from './airquality';
export { antennaUsersTemplate } from './antenna-users';
export { appHealthTemplate } from './app-health';
export { appUsageTemplate } from './app-usage';
export { cisaKevRecentTemplate } from './cisa-kev-recent';
export { cloudflareAnalyticsTemplate } from './cloudflare-analytics';
export { cloudflareIncidentsTemplate } from './cloudflare-incidents';
export { cloudflareWebAnalyticsTemplate } from './cloudflare-web-analytics';
export { cryptoHistoryTemplate } from './crypto-history';
export { cryptoWatchlistTemplate } from './crypto-watchlist';
export { equityWatchlistTemplate } from './equity-watchlist';
export { fxPairTemplate } from './fx-pair';
export { githubRepoActivityTemplate } from './github-repo-activity';
export { githubSecurityAdvisoriesTemplate } from './github-security-advisories';
export { githubTrendingTemplate } from './github-trending';
export { karpathyJobsSnapshotTemplate } from './karpathy-jobs-snapshot';
export { macroMarketHistoryTemplate } from './macro-market-history';
export { manualCostTemplate } from './manual-cost';
export { manualMetricTemplate } from './manual-metric';
export { marketHistoryTemplate } from './market-history';
export { marketOverviewTemplate } from './market-overview';
export { projectPortfolioTemplate } from './project-portfolio';
export { restMetricTemplate } from './rest-metric';
export { sectorMoversTemplate } from './sector-movers';
export { tbenchLeaderboardTemplate } from './tbench-leaderboard';
export { tradingEconomicsMarketTemplate } from './trading-economics-market';
export { ukEconomicCalendarTemplate } from './uk-economic-calendar';
export { weatherTemplate } from './weather';

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
  appHealthTemplate,
  cloudflareWebAnalyticsTemplate,
] as const;
