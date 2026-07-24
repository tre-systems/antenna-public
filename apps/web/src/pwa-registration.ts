import { registerSW } from 'virtual:pwa-register';
import {
  checkForAppUpdate,
  installAppUpdateChecks,
  recordServiceWorkerRegistration,
  reloadApp,
  supportsServiceWorkers,
} from './pwa-update';

let registered = false;

export function registerAppServiceWorker(): void {
  if (registered || typeof window === 'undefined' || !supportsServiceWorkers()) return;
  registered = true;

  let hadController = navigator.serviceWorker.controller !== null;

  registerSW({
    immediate: true,
    onNeedReload: reloadApp,
    onRegisteredSW(scriptUrl, registration) {
      recordServiceWorkerRegistration(registration, scriptUrl);
      void checkForAppUpdate({ force: true });
    },
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reloadApp();
    hadController = true;
  });

  installAppUpdateChecks(() => {
    void checkForAppUpdate();
  });
}
