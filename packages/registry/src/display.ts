import { sourcePolicyForTemplate } from './source-policy';
import { safeExternalUrl } from './safe-url';

export type RegistryDisplay = {
  readonly title: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string | null;
};

export type RegistryPointInput = {
  readonly dimensions: Readonly<Record<string, string | number>> | null;
  readonly valueText?: string | null;
  readonly sourceUrl?: string | null;
};

export type RegistryPointDisplay = {
  readonly label: string;
  readonly sourceUrl: string | null;
};

export const resolveTemplateDisplay = (
  templateId: string,
  fallbackTitle: string,
  config: Readonly<Record<string, unknown>>,
  pointSourceUrls: ReadonlyArray<string | null | undefined> = [],
): RegistryDisplay => {
  const policy = sourcePolicyForTemplate(templateId);
  const preset = macroPreset(templateId, config);
  return {
    title: displayTitle(templateId, fallbackTitle, config),
    sourceLabel: preset?.sourceLabel ?? policy?.label ?? templateId,
    sourceUrl: sourceUrl(templateId, config, pointSourceUrls, preset),
  };
};

export const resolvePointDisplay = (
  templateId: string,
  point: RegistryPointInput,
): RegistryPointDisplay => ({
  label: pointLabel(point),
  sourceUrl: pointSourceUrl(templateId, point),
});

const LIST_TITLE_MAX = 3;

const displayTitle = (
  templateId: string,
  fallback: string,
  config: Readonly<Record<string, unknown>>,
): string => {
  if (templateId === 'fx-pair') {
    const pair = stringValue(config.pair);
    if (pair) return pair;
    const base = stringValue(config.base);
    const quote = stringValue(config.quote);
    if (base && quote) return `${base}/${quote}`;
  }
  if (templateId === 'crypto-watchlist') {
    const pairs = splitList(config.pairs).map(stripQuote);
    if (pairs.length) return formatListTitle('Crypto', pairs);
  }
  if (templateId === 'crypto-history') {
    const pairs = splitList(config.pairs).map(stripQuote);
    if (pairs.length) return formatListTitle('Crypto history', pairs);
  }
  if (templateId === 'weather' || templateId === 'airquality') {
    const location = stringValue(config.location);
    if (location) return `${templateId === 'weather' ? 'Weather' : 'Air quality'} — ${location}`;
  }
  if (templateId === 'equity-watchlist') {
    const tickers = splitList(config.tickers).map(stripExchange);
    if (tickers.length) return formatListTitle('Stocks', tickers);
  }
  if (templateId === 'market-history') {
    const labelOverride = stringValue(config.label);
    if (labelOverride) return `${labelOverride} 1Y`;
    const symbol = stringValue(config.symbol);
    if (symbol) {
      const stripped = stripExchange(symbol);
      return `${stripped} 1Y`;
    }
  }
  if (templateId === 'market-overview') return 'Market overview';
  if (templateId === 'macro-market-history') {
    const preset = macroPreset(templateId, config);
    if (preset) return `${preset.label} 1Y`;
  }
  if (templateId === 'trading-economics-market') {
    const label = stringValue(config.label);
    if (label) return `${label} 1Y`;
    const symbol = stringValue(config.symbol);
    if (symbol) return `${symbol} 1Y`;
  }
  if (templateId === 'github-repo-activity') {
    const owner = stringValue(config.owner);
    const repo = stringValue(config.repo);
    if (owner && repo) return `${owner}/${repo}`;
  }
  if (templateId === 'github-trending') return 'GitHub Trending';
  if (templateId === 'karpathy-jobs-snapshot') return 'AI jobs exposure';
  if (templateId === 'sector-movers') return 'US sector movers';
  if (templateId === 'tbench-leaderboard') return 'Terminal Bench leaderboard';
  if (templateId === 'aa-highlights') {
    const category = stringValue(config.category);
    if (category === 'speed') return 'AA Speed';
    if (category === 'price') return 'AA Price';
    return 'AA Intelligence';
  }
  if (templateId === 'aa-frontier') return 'Frontier model comparison';
  if (templateId === 'app-usage') {
    const project = stringValue(config.project);
    if (project) return `${capitaliseFirst(project)} usage`;
  }
  if (templateId === 'cloudflare-analytics') return 'Cloudflare traffic';
  if (templateId === 'project-portfolio') return 'Project portfolio';
  if (templateId === 'manual-cost') {
    const provider = stringValue(config.provider);
    const project = stringValue(config.project);
    if (provider && project) return `${provider} · ${project} costs`;
    if (provider) return `${provider} costs`;
  }
  if (templateId === 'manual-metric') return stringValue(config.label) ?? fallback;
  return fallback || templateId;
};

const sourceUrl = (
  templateId: string,
  config: Readonly<Record<string, unknown>>,
  pointSourceUrls: ReadonlyArray<string | null | undefined>,
  preset: MacroPreset | null,
): string | null => {
  const pointUrl = pointSourceUrls.map(safeExternalUrl).find((url) => url !== null);
  if (pointUrl) return pointUrl;

  const configured = safeExternalUrl(config.sourceUrl);
  if (configured) return configured;
  if (preset) return preset.sourceUrl;

  if (templateId === 'fx-pair') {
    const base = stringValue(config.base)?.toUpperCase();
    const quote = stringValue(config.quote)?.toUpperCase();
    if (base && quote) {
      return `https://frankfurter.dev/?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
    }
    return 'https://frankfurter.dev/';
  }
  if (templateId === 'crypto-watchlist' || templateId === 'crypto-history') {
    const pair = splitList(config.pairs)[0];
    const base = pair?.split('-')[0]?.toLowerCase();
    return base ? `https://www.coinbase.com/price/${encodeURIComponent(base)}` : null;
  }
  if (templateId === 'equity-watchlist') {
    const tickers = splitList(config.tickers);
    if (tickers.length === 1 && tickers[0]) {
      return `https://stooq.com/q/?s=${encodeURIComponent(tickers[0].toLowerCase())}`;
    }
    return 'https://stooq.com/';
  }
  if (templateId === 'market-history') {
    const symbol = stringValue(config.symbol);
    return symbol ? `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/` : null;
  }
  if (templateId === 'weather' || templateId === 'airquality') {
    return typeof config.lat === 'number' && typeof config.lon === 'number'
      ? `https://open-meteo.com/en/forecast?latitude=${String(config.lat)}&longitude=${String(config.lon)}`
      : 'https://open-meteo.com/';
  }
  if (templateId === 'github-repo-activity') {
    const owner = stringValue(config.owner);
    const repo = stringValue(config.repo);
    if (owner && repo) {
      return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    }
    return 'https://github.com/';
  }
  if (templateId === 'github-trending') return 'https://github.com/trending';
  if (templateId === 'karpathy-jobs-snapshot') return 'https://karpathy.ai/jobs/';
  if (templateId === 'rest-metric') return safeExternalUrl(config.url);
  return safeExternalUrl(sourcePolicyForTemplate(templateId)?.sourceUrl);
};

const formatListTitle = (prefix: string, items: readonly string[]): string => {
  if (items.length === 0) return prefix;
  if (items.length <= LIST_TITLE_MAX) return `${prefix}: ${items.join(', ')}`;
  const shown = items.slice(0, LIST_TITLE_MAX).join(', ');
  return `${prefix}: ${shown} +${String(items.length - LIST_TITLE_MAX)} more`;
};

const splitList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const stripQuote = (pair: string): string => pair.replace(/-USD$/, '');

const stripExchange = (ticker: string): string => ticker.replace(/\.[A-Z]{1,3}$/, '');

const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const pointLabel = (point: RegistryPointInput): string => {
  const dimensions = point.dimensions ?? {};
  const rank = dimensionValue(dimensions.rank);
  if (rank) return `#${rank}`;

  const metric = stringValue(dimensions.metric);
  if (metric === 'market_proxy_change') return stringValue(dimensions.label) ?? 'Move';
  if (metric) return METRIC_LABELS[metric] ?? titleCase(metric.replaceAll('_', ' '));

  const ticker = stringValue(dimensions.ticker);
  if (ticker) return stripExchange(ticker);

  const pair = stringValue(dimensions.pair);
  if (pair) return pair;

  const label = stringValue(dimensions.label);
  if (label) return label;

  return 'Value';
};

const pointSourceUrl = (templateId: string, point: RegistryPointInput): string | null => {
  const supplied = safeExternalUrl(point.sourceUrl);
  if (supplied) return supplied;

  const dimensions = point.dimensions ?? {};
  if (templateId === 'equity-watchlist') {
    const ticker = stringValue(dimensions.ticker);
    return ticker ? `https://stooq.com/q/?s=${encodeURIComponent(ticker.toLowerCase())}` : null;
  }
  if (templateId === 'crypto-watchlist') {
    const pair = stringValue(dimensions.pair);
    const base = pair?.split('-')[0]?.toLowerCase();
    return base ? `https://www.coinbase.com/price/${encodeURIComponent(base)}` : null;
  }
  if (templateId === 'github-trending' && point.valueText) {
    const match = /^([\w.-]+\/[\w.-]+)/.exec(point.valueText);
    return match ? `https://github.com/${match[1]}` : null;
  }
  return null;
};

const titleCase = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

// Capitalise only the first letter, preserving the rest of a project slug
// (e.g. "example-app" → "Example-app") so the app name stays recognisable.
const capitaliseFirst = (value: string): string =>
  value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const dimensionValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const METRIC_LABELS: Readonly<Record<string, string>> = {
  cost: 'Cost',
  temperature: 'Temp',
  humidity: 'Humidity',
  wind: 'Wind',
  feels_like: 'Feels like',
  weather_code: 'Condition',
  uv_index: 'UV',
  is_day: 'Daylight',
  hourly_temperature: 'Forecast temp',
  hourly_precipitation_probability: 'Rain chance',
  hourly_weather_code: 'Forecast',
  pm10: 'PM10',
  pm2_5: 'PM2.5',
  aqi: 'AQI',
  european_aqi: 'EU AQI',
  next_event: 'Next',
  au_price: 'Au',
  ag_price: 'Ag',
  au_1h_vol: 'Au 1h Vol',
  ag_1h_vol: 'Ag 1h Vol',
  xau_3m_dicor: 'Au 3M DICOR',
  occupations: 'Roles',
  jobs_analyzed: 'Jobs',
  weighted_ai_exposure: 'AI exposure',
  high_exposure_share: 'High exposure',
  top_role: 'Top role',
  active_incidents: 'Active',
  recent_incidents: 'Recent',
  critical: 'Critical',
  high: 'High',
  additions: 'Additions',
  market_regime: 'Regime',
  market_proxy_change: 'Move',
};

type MacroPreset = {
  readonly label: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
};

const MACRO_PRESETS: Readonly<Record<string, MacroPreset>> = {
  'uk-10y-gilt': {
    label: 'UK 10Y gilt',
    sourceLabel: 'Bank of England',
    sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
  },
  'gbp-usd': {
    label: 'GBP/USD',
    sourceLabel: 'Frankfurter (ECB)',
    sourceUrl: 'https://frankfurter.dev/',
  },
  gold: {
    label: 'Gold',
    sourceLabel: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/quote/GC=F/',
  },
  'crude-oil': {
    label: 'Crude oil',
    sourceLabel: 'EIA',
    sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
  },
};

const macroPreset = (
  templateId: string,
  config: Readonly<Record<string, unknown>>,
): MacroPreset | null => {
  if (templateId !== 'macro-market-history') return null;
  const preset = config.preset;
  return typeof preset === 'string' ? (MACRO_PRESETS[preset] ?? null) : null;
};
