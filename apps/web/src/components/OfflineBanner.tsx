import { isOffline, lastFetchedAt } from '../signals/signals';
import { relativeTime } from '../relative-time';

// The shell works offline, but sourced values may be cached.
export function OfflineBanner() {
  if (!isOffline.value) return null;
  const lastSeen = lastFetchedAt.value;
  return (
    <div
      role="status"
      class="mb-4 flex items-start gap-2 rounded-md bg-amber-50/80 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-300/40 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30"
      data-testid="offline-banner"
    >
      <span
        aria-hidden="true"
        class="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" class="h-2 w-2">
          <circle cx="8" cy="8" r="6" />
        </svg>
      </span>
      <span>
        Offline —{' '}
        {lastSeen !== null ? (
          <>
            cached data, last seen <time>{relativeTime(lastSeen)}</time>
          </>
        ) : (
          'showing the last data we have'
        )}
        . Numbers will refresh when you reconnect.
      </span>
    </div>
  );
}
