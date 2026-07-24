import { MAX_ALERTS_PER_EMAIL } from './constants';
import { PRODUCT_NAME } from '../../brand';
import { hasText } from './strings';
import type { AlertRow, CollectionRow, DigestCadence, DigestPeriod } from './types';

export const renderText = (
  collection: CollectionRow,
  alerts: readonly AlertRow[],
  period: DigestPeriod,
  cadence: DigestCadence,
  appUrl?: string,
): string => {
  const lines = [
    `${PRODUCT_NAME} ${cadence} brief for ${collection.title}`,
    `Period: ${period.start.toISOString()} to ${period.end.toISOString()}`,
    '',
    ...alerts.slice(0, MAX_ALERTS_PER_EMAIL).map(formatAlertText),
  ];
  appendTextOverflow(lines, alerts.length);
  appendTextAppUrl(lines, appUrl);
  return lines.join('\n');
};

export const renderHtml = (
  collection: CollectionRow,
  alerts: readonly AlertRow[],
  period: DigestPeriod,
  cadence: DigestCadence,
  appUrl?: string,
): string =>
  [
    `<h1>${PRODUCT_NAME} ${cadence} brief</h1>`,
    `<p><strong>${escapeHtml(collection.title)}</strong></p>`,
    `<p>${escapeHtml(period.start.toISOString())} to ${escapeHtml(period.end.toISOString())}</p>`,
    `<ul>${renderHtmlItems(alerts)}</ul>`,
    renderHtmlOverflow(alerts.length),
    renderHtmlAppLink(appUrl),
  ].join('');

const appendTextOverflow = (lines: string[], alertCount: number): void => {
  if (alertCount > MAX_ALERTS_PER_EMAIL) {
    lines.push('', `And ${String(alertCount - MAX_ALERTS_PER_EMAIL)} more alert(s).`);
  }
};

const appendTextAppUrl = (lines: string[], appUrl?: string): void => {
  if (hasText(appUrl)) lines.push('', `Open Antenna: ${appUrl}`);
};

const renderHtmlItems = (alerts: readonly AlertRow[]): string =>
  alerts.slice(0, MAX_ALERTS_PER_EMAIL).map(formatAlertHtml).join('');

const renderHtmlOverflow = (alertCount: number): string =>
  alertCount > MAX_ALERTS_PER_EMAIL
    ? `<p>And ${String(alertCount - MAX_ALERTS_PER_EMAIL)} more alert(s).</p>`
    : '';

const renderHtmlAppLink = (appUrl?: string): string =>
  hasText(appUrl) ? `<p><a href="${escapeHtml(appUrl)}">Open Antenna</a></p>` : '';

const formatAlertHtml = ({ alert, signal }: AlertRow): string => {
  const unit = alert.unit ? ` ${escapeHtml(alert.unit)}` : '';
  return `<li><strong>${escapeHtml(signal.title)}</strong>: ${escapeHtml(alert.ruleLabel)} (${formatNumber(alert.previousValue)} → ${formatNumber(alert.value)}${unit})</li>`;
};

const formatAlertText = ({ alert, signal }: AlertRow): string => {
  const unit = alert.unit ? ` ${alert.unit}` : '';
  return `- ${signal.title}: ${alert.ruleLabel} (${formatNumber(alert.previousValue)} -> ${formatNumber(alert.value)}${unit})`;
};

const formatNumber = (value: number): string =>
  Number.isInteger(value)
    ? String(value)
    : value.toLocaleString('en-GB', { maximumFractionDigits: 6 });

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
