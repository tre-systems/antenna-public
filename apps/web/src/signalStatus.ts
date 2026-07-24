import type { ApiSignal, PublicApiSignal } from './api';

export type DerivedStatus = 'loading' | 'live' | 'stale' | 'error';

export function deriveStatus(
  signal: ApiSignal | PublicApiSignal,
  now: number = Date.now(),
): DerivedStatus {
  const { status, last_ok_at, last_attempt_at, last_error } = signal.status;

  // confirmPlan inserts a signal_status row with status='loading' and a fresh
  // updatedAt before the dispatcher has had a chance to run. The updatedAt
  // surfaces here as a non-null last_attempt_at, so without trusting the
  // explicit status field we'd misclassify a brand-new signal as 'live'.
  if (status === 'loading' && last_ok_at === null) return 'loading';
  if (status === 'stale') return 'stale';

  const hasFreshError =
    last_error !== null && (last_ok_at === null || (last_attempt_at ?? 0) > last_ok_at);
  if (hasFreshError) return 'error';

  if (last_ok_at === null && last_attempt_at === null) return 'loading';

  const refreshSeconds = 'refresh_seconds' in signal ? signal.refresh_seconds : null;
  if (
    last_ok_at !== null &&
    refreshSeconds !== null &&
    now - last_ok_at > refreshSeconds * 2 * 1000
  ) {
    return 'stale';
  }

  return 'live';
}
