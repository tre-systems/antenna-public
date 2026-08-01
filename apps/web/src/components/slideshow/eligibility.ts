import type { ApiSignal } from '../../api';

// Skip signals that have never loaded or are in a setup/error state.
export const isEligible = (signal: ApiSignal): boolean => {
  if (signal.status.status === 'error' && signal.status.last_ok_at === null) return false;
  return signal.points.length > 0 || signal.status.last_ok_at !== null;
};

export const safeIndexFor = (index: number, total: number): number => {
  return total === 0 ? 0 : ((index % total) + total) % total;
};
