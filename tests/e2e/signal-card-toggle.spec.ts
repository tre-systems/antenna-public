import { expect, test } from '@playwright/test';
import { createSeededCollection, deleteCollection } from './shared-fixture';

test('signal card header toggles compact and expanded states', async ({ page }) => {
  const collectionId = await createSeededCollection(page, 'card toggle');

  try {
    await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);

    const card = page.locator('article').filter({ hasText: 'GBP/USD 1Y' });
    await expect(card).toHaveCount(1, { timeout: 15_000 });
    await expect(card).toHaveAttribute('data-expanded', 'false');

    const header = card.getByTestId('signal-card-header');
    await expect(header).toBeVisible();
    await expect(card.getByTestId('signal-details-toggle')).toHaveText('');

    await header.click();
    await expect(card).toHaveAttribute('data-expanded', 'true');

    await header.click();
    await expect(card).toHaveAttribute('data-expanded', 'false');
  } finally {
    await deleteCollection(page, collectionId);
  }
});
