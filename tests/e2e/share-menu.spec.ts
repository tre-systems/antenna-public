import { expect, test } from '@playwright/test';

test('sharing lives behind a Share button, not an always-on toggle', async ({ page }) => {
  await page.goto('/');

  const share = page.getByTestId('share-open');
  await expect(share).toBeVisible({ timeout: 10_000 });

  // The default collection view shows only signals: no visibility controls and
  // no share matrix until the owner opens the Share popover.
  await expect(page.getByTestId('visibility-private')).toHaveCount(0);
  await expect(page.getByTestId('share-menu')).toHaveCount(0);

  await share.click();
  const menu = page.getByTestId('share-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Visibility');
  await expect(page.getByTestId('visibility-private')).toBeVisible();
  await expect(page.getByTestId('visibility-shared')).toBeVisible();

  // Escape dismisses it and returns to the clean signal view.
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});
