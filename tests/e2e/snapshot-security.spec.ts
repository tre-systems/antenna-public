import { expect, type Page, test } from '@playwright/test';
import { createSeededCollection, deleteCollection } from './shared-fixture';

const snapshotCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      Object.keys(localStorage).filter((key) => key.startsWith('antenna.signals.snapshot.')).length,
  );

test('sign-out removes private cards and persisted snapshots', async ({ page }) => {
  const collectionId = await createSeededCollection(page, 'snapshot logout');
  try {
    await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);
    await expect(page.locator('[data-signal-id]').first()).toBeVisible();
    await expect.poll(() => snapshotCount(page)).toBeGreaterThan(0);
    // The local worker's synthetic auth has no Better Auth session to revoke.
    await page.route('**/api/auth/sign-out', (route) => route.fulfill({ json: { success: true } }));
    await page.getByTestId('profile-menu-trigger').click();
    await page.getByTestId('profile-menu-signout').click();
    await expect(page.locator('[data-signal-id]')).toHaveCount(0);
    await expect(page.getByTestId('profile-menu-trigger')).toHaveCount(0);
    await expect.poll(() => snapshotCount(page)).toBe(0);
  } finally {
    await deleteCollection(page, collectionId);
  }
});

for (const status of [401, 403]) {
  test(`HTTP ${status} revokes cached private presentation`, async ({ page }) => {
    const collectionId = await createSeededCollection(page, `snapshot ${status}`);
    try {
      await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);
      await expect(page.locator('[data-signal-id]').first()).toBeVisible();
      await expect.poll(() => snapshotCount(page)).toBeGreaterThan(0);
      await page.route('**/api/signals?*', (route) =>
        route.fulfill({ status, json: { error: 'unauthorized' } }),
      );
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(page.locator('[data-signal-id]')).toHaveCount(0);
      await expect(page.getByTestId('profile-menu-trigger')).toHaveCount(0);
      await expect.poll(() => snapshotCount(page)).toBe(0);
    } finally {
      await deleteCollection(page, collectionId);
    }
  });
}
