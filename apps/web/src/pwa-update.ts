export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
export const UPDATE_CHECK_COOLDOWN_MS = 60 * 1000;
const MANUAL_RELOAD_DELAY_MS = 1000;

let reloading = false;
let lastUpdateCheckAt = 0;
let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
let serviceWorkerScriptUrl = '/sw.js';

export function recordServiceWorkerRegistration(
  registration: ServiceWorkerRegistration | undefined,
  scriptUrl = '/sw.js',
): void {
  serviceWorkerRegistration = registration;
  serviceWorkerScriptUrl = scriptUrl;
}

export async function refreshInstalledApp(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!supportsServiceWorkers()) {
    reloadApp();
    return;
  }

  await checkForAppUpdate({ force: true });
  const registrations = await getRegistrations();
  promoteWaitingWorkers(registrations);
  window.setTimeout(reloadApp, MANUAL_RELOAD_DELAY_MS);
}

export async function checkForAppUpdate({
  force = false,
}: { readonly force?: boolean } = {}): Promise<void> {
  if (!supportsServiceWorkers()) return;

  const now = Date.now();
  if (!force && !shouldCheckForAppUpdate(now, lastUpdateCheckAt)) return;
  lastUpdateCheckAt = now;

  const registrations = [...(await getRegistrations())];
  if (registrations.length === 0 && serviceWorkerRegistration) {
    registrations.push(serviceWorkerRegistration);
  }

  await Promise.all(
    registrations.map(async (registration) => {
      try {
        const scriptUrl =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          serviceWorkerScriptUrl;
        const response = await fetch(scriptUrl, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        });
        if (!response.ok) return;
        await registration.update();
      } catch {
        // Update checks are opportunistic; the app should keep running offline.
      }
    }),
  );

  promoteWaitingWorkers(registrations);
}

export function shouldCheckForAppUpdate(now: number, lastCheckAt: number): boolean {
  return lastCheckAt === 0 || now - lastCheckAt >= UPDATE_CHECK_COOLDOWN_MS;
}

export function installAppUpdateChecks(
  check: () => void,
  {
    windowTarget = window,
    documentTarget = document,
    isVisible = () => document.visibilityState === 'visible',
    isOnline = () => navigator.onLine,
    setIntervalFn = window.setInterval.bind(window),
    clearIntervalFn = window.clearInterval.bind(window),
  }: {
    readonly windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
    readonly documentTarget?: Pick<Document, 'addEventListener' | 'removeEventListener'>;
    readonly isVisible?: () => boolean;
    readonly isOnline?: () => boolean;
    readonly setIntervalFn?: (handler: () => void, timeout: number) => number;
    readonly clearIntervalFn?: (interval: number) => void;
  } = {},
): () => void {
  const checkWhenAvailable = () => {
    if (isVisible() && isOnline()) check();
  };
  const interval = setIntervalFn(checkWhenAvailable, UPDATE_CHECK_INTERVAL_MS);
  documentTarget.addEventListener('visibilitychange', checkWhenAvailable);
  windowTarget.addEventListener('focus', checkWhenAvailable);
  windowTarget.addEventListener('online', checkWhenAvailable);
  windowTarget.addEventListener('pageshow', checkWhenAvailable);
  return () => {
    clearIntervalFn(interval);
    documentTarget.removeEventListener('visibilitychange', checkWhenAvailable);
    windowTarget.removeEventListener('focus', checkWhenAvailable);
    windowTarget.removeEventListener('online', checkWhenAvailable);
    windowTarget.removeEventListener('pageshow', checkWhenAvailable);
  };
}

async function getRegistrations(): Promise<ServiceWorkerRegistration[]> {
  if (!supportsServiceWorkers()) return [];
  if ('getRegistrations' in navigator.serviceWorker) {
    return [...(await navigator.serviceWorker.getRegistrations())];
  }
  return serviceWorkerRegistration ? [serviceWorkerRegistration] : [];
}

function promoteWaitingWorkers(registrations: readonly ServiceWorkerRegistration[]): boolean {
  let promoted = false;
  for (const registration of registrations) {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    promoted ||= registration.waiting !== null;
  }
  return promoted;
}

export function reloadApp(): void {
  if (reloading || typeof window === 'undefined') return;
  reloading = true;
  window.location.reload();
}

export function supportsServiceWorkers(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}
