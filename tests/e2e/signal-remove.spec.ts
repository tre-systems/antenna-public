import { expect, test } from '@playwright/test';
import { createSeededCollection, deleteCollection } from './shared-fixture';

test('hover quick-remove hides the card and undo restores it', async ({ page }) => {
  const collectionId = await createSeededCollection(page, 'remove');

  try {
    await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);

    const gold = page.locator('[data-signal-id]').filter({ hasText: 'Gold' });
    await expect(gold).toHaveCount(1, { timeout: 15_000 });

    // The remove button reveals on card hover and needs a single click.
    await gold.hover();
    const remove = gold.locator('[data-testid^="signal-quick-remove-"]');
    await expect(remove).toBeVisible();
    await remove.click();

    await expect(gold).toHaveCount(0);
    await expect(page.getByTestId('undo-toast')).toBeVisible();

    // Undo within the window brings the card straight back.
    await page.getByTestId('undo-toast-button').click();
    await expect(gold).toHaveCount(1);
    await expect(page.getByTestId('undo-toast')).toHaveCount(0);
  } finally {
    await deleteCollection(page, collectionId);
  }
});
