import type { DataPoint } from '../api';
import { numOf, strOf } from './common';

export const appHealthState = (point: DataPoint): string | null => {
  const state = strOf(point.dimensions?.state);
  // A retained HTTP-0 observation is not evidence that the application returned an error.
  return state === 'down' && numOf(point.dimensions?.http_status) === 0 ? 'probe_error' : state;
};

export const appHealthSubtitle = (point: DataPoint, state: string): string => {
  if (state === 'unconfigured') return 'No server-approved endpoint';
  if (state === 'probe_error') return 'Probe failed · availability unknown';
  const status = numOf(point.dimensions?.http_status);
  if (state === 'redirect') return `HTTP ${String(status)} · redirect not followed`;
  return `HTTP ${String(Math.round(status))} · ${Math.round(numOf(point.dimensions?.latency_ms))} ms`;
};

export const appHealthSummary = (points: ReadonlyArray<DataPoint>): string => {
  const states = points
    .filter((point) => point.dimensions?.metric === 'app_health')
    .map(appHealthState);
  const down = states.filter((state) => state === 'down').length;
  const degraded = states.filter((state) => state === 'degraded').length;
  const healthy = states.filter((state) => state === 'healthy').length;
  const unknown = states.length - down - degraded - healthy;
  const problems = [
    down ? `${String(down)} down` : '',
    degraded ? `${String(degraded)} degraded` : '',
    unknown ? `${String(unknown)} unknown` : '',
  ].filter(Boolean);
  return problems.length
    ? problems.join(' · ')
    : `${String(healthy)}/${String(states.length)} healthy`;
};
