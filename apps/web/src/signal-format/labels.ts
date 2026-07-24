import type { DataPoint } from '../api';

const METRIC_LABELS: Record<string, string> = {
  temperature: 'Temp',
  humidity: 'Humidity',
  wind: 'Wind',
  aqi: 'AQI',
  european_aqi: 'AQI',
  pm2_5: 'PM2.5',
  pm10: 'PM10',
  stars: 'Stars',
  open_issues: 'Issues',
  forks: 'Forks',
  next_event: 'Next',
  events_count: 'Upcoming',
  au_price: 'Au',
  ag_price: 'Ag',
  au_change_pct: 'Au %',
  ag_change_pct: 'Ag %',
  au_1h_vol: 'Au 1h Vol',
  ag_1h_vol: 'Ag 1h Vol',
  xau_3m_dicor: 'Au 3M DICOR',
  xag_3m_dicor: 'Ag 3M DICOR',
  occupations: 'Roles',
  jobs_analyzed: 'Jobs',
  weighted_ai_exposure: 'AI exposure',
  high_exposure_jobs: 'High exposure',
  high_exposure_share: 'High share',
};

export function pointLabel(point: DataPoint): string {
  if (point.display?.label) return point.display.label;
  const d = point.dimensions ?? {};
  if (d.rank !== undefined) return `#${String(d.rank)}`;
  if (typeof d.metric === 'string') return METRIC_LABELS[d.metric] ?? humanize(d.metric);
  if (typeof d.ticker === 'string') return stripExchange(d.ticker);
  if (typeof d.pair === 'string') return d.pair;
  if (typeof d.label === 'string') return d.label;
  const vals = Object.values(d);
  if (vals.length === 0) return '';
  return vals.map((v) => String(v)).join(' · ');
}

const stripExchange = (ticker: string): string => ticker.replace(/\.[A-Z]{1,3}$/, '');

const humanize = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
