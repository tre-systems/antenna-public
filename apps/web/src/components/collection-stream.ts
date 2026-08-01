// Kept framework-free so SSE fallback behavior is testable without DOM shims.

const FALLBACK_POLL_MS = 30_000;
const STALENESS_THRESHOLD_MS = 60_000;
const STALENESS_CHECK_MS = 10_000;
const ERROR_FALLBACK_THRESHOLD = 3;

type StreamHooks = {
  readonly onEvent: () => void;
  readonly now?: () => number;
  // Overridable so tests can swap EventSource and timers for fakes.
  readonly createEventSource?: (url: string) => EventSource | null;
  readonly setIntervalFn?: typeof globalThis.setInterval;
  readonly clearIntervalFn?: typeof globalThis.clearInterval;
};

type StreamConnection = { readonly close: () => void };

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
    // EventSource reconnects itself, so poll only after repeated hard failures.
    if (consecutiveErrors >= ERROR_FALLBACK_THRESHOLD) startFallback();
  });

  // A silently dropped connection never fires `error`, so watch for staleness.
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
