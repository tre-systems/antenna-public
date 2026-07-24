import { expect, test } from '@playwright/test';
import { createSharedFixture, deleteCollection } from './shared-fixture';

test('shared collection link renders shareable signals without owner controls', async ({
  page,
}) => {
  const fixture = await createSharedFixture(page);

  try {
    await page.goto(`/c/${fixture.slug}`);

    await expect(page.getByTestId('public-grid')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('article').filter({ hasText: /CHF.*USD|USD.*CHF/ })).toHaveCount(1);
    await expect(page.getByTestId('public-cta-sign-in')).toBeVisible();
    await expect(page.getByTestId('header-add-signal')).toHaveCount(0);
    await expect(page.getByTestId('visibility-private')).toHaveCount(0);
    await expect(page.getByTestId('public-cta-discover')).toHaveCount(0);
    await expect(page.getByTestId('public-cta-fork')).toHaveCount(0);
    await expect(page.getByTestId('public-cta-report')).toHaveCount(0);
  } finally {
    await deleteCollection(page, fixture.collectionId);
  }
});
