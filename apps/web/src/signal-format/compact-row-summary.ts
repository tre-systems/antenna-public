import type { DataPoint } from '../api';
import { capitalize, configOf, numOf } from './common';
import type { RenderSignal } from './types';

export const summaryFor = (signal: RenderSignal, rowCount: number): string | null => {
  if (rowCount === 0) return null;
  if (signal.template_id === 'cloudflare-incidents') return cloudflareSummary(signal.points);
  if (signal.template_id === 'github-security-advisories')
    return githubAdvisorySummary(signal.points);
  if (signal.template_id === 'cisa-kev-recent') return cisaSummary(signal.points, rowCount);
  if (signal.template_id === 'uk-economic-calendar') return `Next ${String(rowCount)} events`;
  if (signal.template_id === 'sector-movers') return sectorMoverSummary(signal.points);
  if (signal.template_id === 'tbench-leaderboard') return `Top ${String(rowCount)} verified`;
  if (signal.template_id === 'aa-highlights') return aaHighlightsSummary(signal, rowCount);
  if (signal.template_id === 'aa-frontier') return `Top ${String(rowCount)} · score, speed & price`;
  if (signal.template_id === 'project-portfolio') return projectPortfolioSummary(signal.points);
  if (signal.template_id === 'app-health') return appHealthSummary(signal.points);
  if (signal.template_id === 'cloudflare-web-analytics') return webAnalyticsSummary(signal.points);
  if (signal.template_id === 'karpathy-jobs-snapshot')
    return `Top ${String(rowCount)} most exposed`;
  if (signal.template_id === 'market-overview') return marketOverviewSummary(signal.points);
  return null;
};

const appHealthSummary = (points: ReadonlyArray<DataPoint>): string => {
  const rows = points.filter((point) => point.dimensions?.metric === 'app_health');
  const healthy = rows.filter((point) => point.dimensions?.state === 'healthy').length;
  const degraded = rows.filter((point) => point.dimensions?.state === 'degraded').length;
  const down = rows.filter((point) => point.dimensions?.state === 'down').length;
  if (down) return `${String(down)} down${degraded ? ` · ${String(degraded)} degraded` : ''}`;
  return degraded
    ? `${String(degraded)} degraded`
    : `${String(healthy)}/${String(rows.length)} healthy`;
};

const webAnalyticsSummary = (points: ReadonlyArray<DataPoint>): string => {
  const rows = points.filter((point) => point.dimensions?.metric === 'host_traffic');
  const visits = rows.reduce((sum, point) => sum + Math.max(0, Number(point.value) || 0), 0);
  const active = rows.filter((point) => Number(point.value) > 0).length;
  const unseen = rows.filter((point) => point.dimensions?.telemetry_state === 'unseen').length;
  return `${visits.toLocaleString('en-GB')} visits · ${String(active)}/${String(rows.length)} active${
    unseen ? ` · ${String(unseen)} unseen` : ''
  }`;
};

const projectPortfolioSummary = (points: ReadonlyArray<DataPoint>): string => {
  const rows = points.filter((point) => point.dimensions?.metric === 'project_activity');
  const active = rows.filter((point) => Number(point.value) > 0).length;
  const events = rows.reduce((sum, point) => sum + Math.max(0, Number(point.value) || 0), 0);
  return `${events.toLocaleString('en-GB')} product events · ${String(active)}/${String(
    rows.length,
  )} active`;
};

const cloudflareSummary = (points: ReadonlyArray<DataPoint>): string => {
  const active = points.filter(
    (p) => p.dimensions?.metric === 'incident' && p.dimensions.status !== 'resolved',
  ).length;
  return active > 0 ? `${active} active` : 'All resolved';
};

const githubAdvisorySummary = (points: ReadonlyArray<DataPoint>): string => {
  const counts = points.filter((p) => p.dimensions?.metric === 'recent_by_severity');
  const crit = counts.find((p) => p.dimensions?.severity === 'critical');
  const high = counts.find((p) => p.dimensions?.severity === 'high');
  const critN = typeof crit?.value === 'number' ? crit.value : 0;
  const highN = typeof high?.value === 'number' ? high.value : 0;
  if (critN + highN === 0) return 'Quiet';
  return `${critN} critical · ${highN} high (7d)`;
};

const cisaSummary = (points: ReadonlyArray<DataPoint>, rowCount: number): string => {
  const recent = points.find((p) => p.dimensions?.metric === 'recent_additions');
  const n = typeof recent?.value === 'number' ? recent.value : rowCount;
  return `${n} added (7d)`;
};

const sectorMoverSummary = (points: ReadonlyArray<DataPoint>): string => {
  let up = 0;
  let down = 0;
  for (const p of points) {
    const v = p.dimensions?.metric === 'sector_change' ? Number(p.value) : Number.NaN;
    if (!Number.isFinite(v)) continue;
    if (v > 0) up += 1;
    else if (v < 0) down += 1;
  }
  return `${String(up)} up · ${String(down)} down`;
};

const aaHighlightsSummary = (signal: RenderSignal, rowCount: number): string => {
  const cat = configOf(signal).category;
  if (cat === 'speed') return `Top ${String(rowCount)} fastest`;
  if (cat === 'price') return `Top ${String(rowCount)} cheapest`;
  return `Top ${String(rowCount)} by intelligence`;
};

const marketOverviewSummary = (points: ReadonlyArray<DataPoint>): string => {
  const regime = points.find((p) => p.dimensions?.metric === 'market_regime');
  const regimeText = typeof regime?.value === 'string' ? regime.value : 'mixed';
  const pos = numOf(regime?.dimensions?.positive_count);
  const neg = numOf(regime?.dimensions?.negative_count);
  return `${capitalize(regimeText)} · ${String(pos)} up · ${String(neg)} down`;
};
