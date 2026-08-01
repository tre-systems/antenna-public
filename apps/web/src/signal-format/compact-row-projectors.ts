import type { DataPoint } from '../api';
import { numOf, strOf } from './common';
import { aaFrontierRow, aaHighlightRow, tbenchRow } from './compact-row-benchmark-projectors';
import {
  cloudflareStatusTone,
  countdownTone,
  formatDateAdded,
  formatDaysUntil,
  formatJobsCount,
  formatSignedPercent,
  severityTone,
  stripSeverityPrefix,
} from './compact-row-format';
import { appHealthRow, portfolioRow, webAnalyticsRow } from './compact-row-operations-projectors';
import type { CompactRow } from './compact-row-types';
import { safeExternalUrl } from './display';
import type { RenderSignal } from './types';

export const projectRow = (signal: RenderSignal, p: DataPoint, rank: number): CompactRow | null => {
  const href = hrefOf(p);
  if (signal.template_id === 'aa-highlights') return aaHighlightRow(p, rank, href);
  if (signal.template_id === 'aa-frontier') return aaFrontierRow(p, rank, href);
  if (signal.template_id === 'project-portfolio') return portfolioRow(p, rank);
  if (signal.template_id === 'app-health') return appHealthRow(p, rank, href);
  if (signal.template_id === 'cloudflare-web-analytics') return webAnalyticsRow(p, rank, href);
  if (signal.template_id === 'tbench-leaderboard') return tbenchRow(p, rank, href);
  if (signal.template_id === 'sector-movers') return sectorMoverRow(p, rank, href);
  if (signal.template_id === 'market-overview') return marketOverviewRow(p, rank, href);
  if (signal.template_id === 'karpathy-jobs-snapshot') return karpathyRoleRow(p, rank, href);
  const text = pointText(p);
  if (!text) return null;
  if (signal.template_id === 'cloudflare-incidents') return cloudflareRow(p, rank, text, href);
  if (signal.template_id === 'github-security-advisories')
    return githubAdvisoryRow(p, rank, text, href);
  if (signal.template_id === 'cisa-kev-recent') return cisaRow(p, rank, text, href);
  if (signal.template_id === 'uk-economic-calendar') return ukCalendarRow(p, rank, text, href);
  return null;
};

const hrefOf = (point: DataPoint): string | null => safeExternalUrl(point.source_url);

const pointText = (point: DataPoint): string | null =>
  typeof point.value === 'string' ? point.value : (point.value_text ?? null);

const sectorMoverRow = (p: DataPoint, rank: number, href: string | null): CompactRow | null => {
  const sector = strOf(p.dimensions?.sector);
  const ticker = strOf(p.dimensions?.ticker);
  const change = typeof p.value === 'number' ? p.value : Number(p.value);
  if (!sector || !ticker || !Number.isFinite(change)) return null;
  return signedChangeRow(rank, sector, ticker, change, href);
};

const marketOverviewRow = (p: DataPoint, rank: number, href: string | null): CompactRow | null => {
  const label = strOf(p.dimensions?.label);
  const ticker = strOf(p.dimensions?.ticker);
  const role = strOf(p.dimensions?.role);
  const change = typeof p.value === 'number' ? p.value : Number(p.value);
  if (!label || !ticker || !Number.isFinite(change)) return null;
  return signedChangeRow(rank, label, role ? `${ticker} · ${role}` : ticker, change, href);
};

const signedChangeRow = (
  rank: number,
  title: string,
  subtitle: string,
  change: number,
  href: string | null,
): CompactRow => ({
  rank,
  title,
  subtitle,
  chip: formatSignedPercent(change),
  chipTone: change > 0 ? 'ok' : change < 0 ? 'urgent' : 'muted',
  href,
});

const karpathyRoleRow = (p: DataPoint, rank: number, href: string | null): CompactRow | null => {
  const category = strOf(p.dimensions?.category);
  const exposure = numOf(p.dimensions?.exposure);
  const jobs = numOf(p.dimensions?.jobs);
  if (!category || !Number.isFinite(exposure)) return null;
  return {
    rank,
    title: category,
    subtitle: Number.isFinite(jobs) ? `${formatJobsCount(jobs)} jobs` : null,
    chip: `${Math.round(exposure)}%`,
    chipTone: exposure > 60 ? 'warn' : exposure >= 30 ? 'info' : 'ok',
    href,
  };
};

const cloudflareRow = (
  p: DataPoint,
  rank: number,
  title: string,
  href: string | null,
): CompactRow => {
  const status = strOf(p.dimensions?.status);
  return {
    rank,
    title,
    subtitle: strOf(p.dimensions?.components),
    chip: status,
    chipTone: cloudflareStatusTone(status),
    href,
  };
};

const githubAdvisoryRow = (
  p: DataPoint,
  rank: number,
  text: string,
  href: string | null,
): CompactRow => {
  const severity = strOf(p.dimensions?.severity);
  return {
    rank,
    title: stripSeverityPrefix(text),
    subtitle: strOf(p.dimensions?.packages),
    chip: severity?.toUpperCase() ?? null,
    chipTone: severityTone(severity),
    href,
  };
};

const cisaRow = (p: DataPoint, rank: number, title: string, href: string | null): CompactRow => {
  const dateAdded = strOf(p.dimensions?.date_added);
  const vendor = strOf(p.dimensions?.vendor);
  const product = strOf(p.dimensions?.product);
  const cve = strOf(p.dimensions?.cve);
  return {
    rank,
    title,
    subtitle: vendor && product ? `${vendor} ${product}` : (vendor ?? product ?? cve),
    chip: dateAdded ? formatDateAdded(dateAdded) : null,
    chipTone: 'urgent',
    href,
  };
};

const ukCalendarRow = (
  p: DataPoint,
  rank: number,
  title: string,
  href: string | null,
): CompactRow => {
  const days = numOf(p.dimensions?.days_until);
  return {
    rank,
    title,
    subtitle: strOf(p.dimensions?.date),
    chip: Number.isFinite(days) ? formatDaysUntil(days) : null,
    chipTone: countdownTone(days),
    href,
  };
};
