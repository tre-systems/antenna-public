import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkForAppUpdate,
  installAppUpdateChecks,
  recordServiceWorkerRegistration,
  shouldCheckForAppUpdate,
} from './pwa-update';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('installed app update checks', () => {
  it('uses a short cooldown for clustered lifecycle events', () => {
    expect(shouldCheckForAppUpdate(1, 0)).toBe(true);
    expect(shouldCheckForAppUpdate(60_000, 1)).toBe(false);
    expect(shouldCheckForAppUpdate(60_001, 1)).toBe(true);
  });

  it('checks on resume, focus, reconnect, and page restore', () => {
    const check = vi.fn();
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    const cleanup = installAppUpdateChecks(check, {
      windowTarget,
      documentTarget,
      isVisible: () => true,
      isOnline: () => true,
      setIntervalFn: vi.fn(() => 1),
      clearIntervalFn: vi.fn(),
    });
    windowTarget.dispatchEvent(new Event('focus'));
    windowTarget.dispatchEvent(new Event('online'));
    windowTarget.dispatchEvent(new Event('pageshow'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(check).toHaveBeenCalledTimes(4);
    cleanup();
  });

  it('bypasses browser caches before updating the registration', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const registration = {
      active: { scriptURL: 'https://antenna.test/sw.js' },
      waiting: null,
      update,
    } as unknown as ServiceWorkerRegistration;
    const getRegistrations = vi.fn().mockResolvedValue([registration]);
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations },
    });
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    recordServiceWorkerRegistration(registration);

    await checkForAppUpdate({ force: true });

    expect(fetcher).toHaveBeenCalledWith(
      'https://antenna.test/sw.js',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(update).toHaveBeenCalledOnce();
  });
});
