// Live e2e for the add-signal flow. By default Playwright starts a local
// Worker-backed SPA; set BASE_URL to run the same flow against an existing URL.

import { test, expect } from '@playwright/test';
import { openSignalComposer } from './shared-fixture';

test('user can plan and confirm an FX signal', async ({ page }) => {
  await page.goto('/');
  await openSignalComposer(page);

  const input = page.getByTestId('signal-composer-input');
  await input.fill('track CHF/USD');
  await page.getByTestId('signal-composer-submit').click();

  const preview = page.getByTestId('plan-preview');
  await expect(preview).toBeVisible({ timeout: 15_000 });
  await expect(preview).toContainText(/CHF/);
  await expect(preview).toContainText(/USD/);

  const confirm = page.getByTestId('plan-preview-confirm');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // A success toast confirms creation. It auto-dismisses, so assert promptly.
  await expect(page.getByTestId('notice-toast')).toContainText(/fetching data/i, {
    timeout: 10_000,
  });

  // The new signal appears within 90s; the cron tick may still be pending,
  // so we only assert the signal is rendered, not that it has data points.
  await expect(page.locator('article').filter({ hasText: /CHF.*USD|USD.*CHF/ })).toHaveCount(1, {
    timeout: 90_000,
  });
});
