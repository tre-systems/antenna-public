// Connection plumbing for the collection SSE stream. Kept in a plain module
// (no Preact dependencies) so it can be unit-tested without DOM/EventSource
// shims wired into the component itself.

const FALLBACK_POLL_MS = 30_000;
const STALENESS_THRESHOLD_MS = 60_000;
const STALENESS_CHECK_MS = 10_000;
const ERROR_FALLBACK_THRESHOLD = 3;

export type StreamHooks = {
  readonly onEvent: () => void;
  readonly now?: () => number;
  // Lets tests swap EventSource / setInterval out. In production the defaults
  // (globalThis.EventSource, globalThis.setInterval) are wired up by the
  // browser.
  readonly createEventSource?: (url: string) => EventSource | null;
  readonly setIntervalFn?: typeof globalThis.setInterval;
  readonly clearIntervalFn?: typeof globalThis.clearInterval;
};

export type StreamConnection = { readonly close: () => void };

const defaultCreateEventSource = (url: string): EventSource | null => {
  const Ctor = (globalThis as { EventSource?: typeof EventSource }).EventSource;
  return Ctor ? new Ctor(url) : null;
};

export const connectCollectionStream = (url: string, hooks: StreamHooks): StreamConnection => {
  const now = hooks.now ?? (() => Date.now());
  const setInt = hooks.setIntervalFn ?? globalThis.setInterval;
  const clearInt = hooks.clearIntervalFn ?? globalThis.clearInterval;
  const createES = hooks.createEventSource ?? defaultCreateEventSource;

  let lastEventAt = now();
  let consecutiveErrors = 0;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;

  const markEvent = (): void => {
    lastEventAt = now();
    consecutiveErrors = 0;
    hooks.onEvent();
  };

  const startFallback = (): void => {
    if (fallbackTimer !== null) return;
    fallbackTimer = setInt(() => {
      hooks.onEvent();
    }, FALLBACK_POLL_MS);
  };

  const stopFallback = (): void => {
    if (fallbackTimer === null) return;
    clearInt(fallbackTimer);
    fallbackTimer = null;
  };

  const es = createES(url);
  if (!es) {
    // No EventSource in this environment — fall straight back to polling.
    startFallback();
    return {
      close: () => {
        stopFallback();
      },
    };
  }

  es.addEventListener('message', markEvent);
  es.addEventListener('open', () => {
    consecutiveErrors = 0;
    stopFallback();
    lastEventAt = now();
  });
  es.addEventListener('error', () => {
    consecutiveErrors += 1;
    // EventSource reconnects automatically; we only spin up the poller as a
    // belt-and-braces fallback after repeated failures (e.g. server returning
    // a hard 5xx). Once SSE recovers, `open` clears the poller.
    if (consecutiveErrors >= ERROR_FALLBACK_THRESHOLD) startFallback();
  });

  // Defensive: if no event in 60s (likely a silently dropped connection that
  // EventSource hasn't noticed), force a refetch to keep data fresh.
  const staleness = setInt(() => {
    if (now() - lastEventAt > STALENESS_THRESHOLD_MS) {
      lastEventAt = now();
      hooks.onEvent();
    }
  }, STALENESS_CHECK_MS);
  return {
    close: () => {
      es.close();
      clearInt(staleness);
      stopFallback();
    },
  };
};
