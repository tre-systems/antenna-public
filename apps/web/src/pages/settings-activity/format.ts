import type { SignalAlertRecord } from '../../api';

export function formatAlertValue(alert: SignalAlertRecord): string {
  const unit = alert.unit ? ` ${alert.unit}` : '';
  return `${formatNumber(alert.previous_value)} → ${formatNumber(alert.value)}${unit}`;
}

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
