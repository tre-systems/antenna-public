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
export { fxPairTemplate } from './fx-pair';
export { cryptoWatchlistTemplate } from './crypto-watchlist';
export { cryptoHistoryTemplate } from './crypto-history';
export { weatherTemplate } from './weather';
export { airQualityTemplate } from './airquality';
export { equityWatchlistTemplate } from './equity-watchlist';
export { marketHistoryTemplate } from './market-history';
export { marketOverviewTemplate } from './market-overview';
export { sectorMoversTemplate } from './sector-movers';
export { macroMarketHistoryTemplate } from './macro-market-history';
export { tradingEconomicsMarketTemplate } from './trading-economics-market';
export { githubTrendingTemplate } from './github-trending';
export { githubRepoActivityTemplate } from './github-repo-activity';
export { karpathyJobsSnapshotTemplate } from './karpathy-jobs-snapshot';
export { manualMetricTemplate } from './manual-metric';
export { manualCostTemplate } from './manual-cost';
export { restMetricTemplate } from './rest-metric';
export { cisaKevRecentTemplate } from './cisa-kev-recent';
export { cloudflareIncidentsTemplate } from './cloudflare-incidents';
export { githubSecurityAdvisoriesTemplate } from './github-security-advisories';
export { aaHighlightsTemplate } from './aa-highlights';
export { aaFrontierTemplate } from './aa-frontier';
export { tbenchLeaderboardTemplate } from './tbench-leaderboard';
export { ukEconomicCalendarTemplate } from './uk-economic-calendar';
export { appUsageTemplate } from './app-usage';
export { cloudflareAnalyticsTemplate } from './cloudflare-analytics';
export { projectPortfolioTemplate } from './project-portfolio';
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
] as const;
