import { safeExternalUrl } from './safe-url';
import { dimensionValue, stringValue, stripExchange, titleCase } from './display-values';

export type RegistryPointInput = {
  readonly dimensions: Readonly<Record<string, string | number>> | null;
  readonly valueText?: string | null;
  readonly sourceUrl?: string | null;
};

export type RegistryPointDisplay = {
  readonly label: string;
  readonly sourceUrl: string | null;
};

export const pointLabel = (point: RegistryPointInput): string => {
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

export const pointSourceUrl = (templateId: string, point: RegistryPointInput): string | null => {
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

const METRIC_LABELS: Readonly<Record<string, string>> = {
  cost: 'Cost',
  total_users: 'Total users',
  active_users_7d: 'Active (7d)',
  new_users_7d: 'New (7d)',
  new_users_24h: 'New (24h)',
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
