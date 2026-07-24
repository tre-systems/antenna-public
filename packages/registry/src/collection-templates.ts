import type { CollectionTemplate } from './types';

export const collectionTemplates = [
  {
    id: 'founder-morning',
    label: 'Founder Morning',
    description: 'A concise daily scan for product, market, AI, and operational awareness.',
    summary:
      'Market overview, GitHub Trending, AI model highlights, Karpathy jobs, and UK calendar.',
    signals: [
      { templateId: 'market-overview', title: 'Market overview', config: {} },
      { templateId: 'github-trending', title: 'GitHub Trending', config: {} },
      {
        templateId: 'aa-frontier',
        title: 'Frontier model comparison',
        config: { limit: 5 },
      },
      { templateId: 'karpathy-jobs-snapshot', title: 'Karpathy jobs', config: {} },
      { templateId: 'uk-economic-calendar', title: 'UK economic calendar', config: {} },
    ],
  },
  {
    id: 'ai-frontier-watch',
    label: 'AI Frontier',
    description:
      'A private briefing on frontier model capability, practical agent performance, ecosystem movement, and jobs exposure.',
    summary:
      'Joined model intelligence/cost/speed, Terminal-Bench, GitHub Trending, and jobs exposure.',
    signals: [
      {
        templateId: 'aa-frontier',
        title: 'Frontier model comparison',
        config: { limit: 5 },
      },
      {
        templateId: 'tbench-leaderboard',
        title: 'Terminal-Bench leaderboard',
        config: { limit: 5 },
      },
      { templateId: 'github-trending', title: 'GitHub Trending', config: {} },
      { templateId: 'karpathy-jobs-snapshot', title: 'AI jobs exposure', config: {} },
    ],
  },
  {
    id: 'trader-morning',
    label: 'Trader Morning',
    description:
      'A high-level market pulse for rates, currency, commodities, crypto, and equities.',
    summary: 'Market overview, GBP/USD, gold, crude oil, Bitcoin history, and broad US ETFs.',
    signals: [
      { templateId: 'market-overview', title: 'Market overview', config: {} },
      {
        templateId: 'macro-market-history',
        title: 'GBP/USD',
        config: { preset: 'gbp-usd' },
      },
      { templateId: 'macro-market-history', title: 'Gold', config: { preset: 'gold' } },
      { templateId: 'macro-market-history', title: 'Crude oil', config: { preset: 'crude-oil' } },
      { templateId: 'crypto-history', title: 'Bitcoin history', config: { pairs: 'BTC-USD' } },
      {
        templateId: 'equity-watchlist',
        title: 'US ETF watchlist',
        config: { tickers: 'VTI.US,SPY.US,QQQ.US' },
      },
    ],
  },
  {
    id: 'ops-morning',
    label: 'Ops Morning',
    description: 'Infrastructure and security signals for an engineering operations check-in.',
    summary: 'Cloudflare incidents, CISA KEV, npm advisories, GitHub Trending, and Terminal-Bench.',
    signals: [
      { templateId: 'cloudflare-incidents', title: 'Cloudflare incidents', config: {} },
      { templateId: 'cisa-kev-recent', title: 'CISA KEV recent additions', config: {} },
      { templateId: 'github-security-advisories', title: 'GitHub Security Advisories', config: {} },
      { templateId: 'github-trending', title: 'GitHub Trending', config: {} },
      {
        templateId: 'tbench-leaderboard',
        title: 'Terminal-Bench leaderboard',
        config: { limit: 5 },
      },
    ],
  },
  {
    id: 'investor-watchlist',
    label: 'Investor Watchlist',
    description:
      'A compact private investing collection for broad markets and personal watchlists.',
    summary: 'Market overview, yearly equity and crypto charts, broad ETFs, GBP/USD, and gold.',
    signals: [
      { templateId: 'market-overview', title: 'Market overview', config: {} },
      { templateId: 'market-history', title: 'VTI yearly chart', config: { symbol: 'VTI' } },
      { templateId: 'crypto-history', title: 'Bitcoin history', config: { pairs: 'BTC-USD' } },
      {
        templateId: 'equity-watchlist',
        title: 'US ETF watchlist',
        config: { tickers: 'VTI.US,SPY.US,QQQ.US' },
      },
      {
        templateId: 'macro-market-history',
        title: 'GBP/USD',
        config: { preset: 'gbp-usd' },
      },
      { templateId: 'macro-market-history', title: 'Gold', config: { preset: 'gold' } },
    ],
  },
  {
    id: 'local-living',
    label: 'Local Living',
    description:
      'A daily local context collection using London defaults that can be edited after creation.',
    summary: 'Weather, air quality, and UK economic calendar.',
    signals: [
      {
        templateId: 'weather',
        title: 'London weather',
        config: { lat: 51.5072, lon: -0.1276, location: 'London' },
      },
      {
        templateId: 'airquality',
        title: 'London air quality',
        config: { lat: 51.5072, lon: -0.1276, location: 'London' },
      },
      { templateId: 'uk-economic-calendar', title: 'UK economic calendar', config: {} },
    ],
  },
] as const satisfies readonly CollectionTemplate[];
