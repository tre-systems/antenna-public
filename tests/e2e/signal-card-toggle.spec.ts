import { expect, test, type Page } from '@playwright/test';
import { deleteCollection } from './shared-fixture';

type CollectionRecord = {
  readonly id: string;
};

test('signal card header toggles compact and expanded states', async ({ page }) => {
  const collection = await postJson<CollectionRecord>(page, '/api/collections', {
    title: `E2E card toggle ${Date.now()}`,
    visibility: 'private',
    template_id: 'trader-morning',
  });
  await patchJson(page, '/api/me/onboarding', { completed: true });

  try {
    await page.goto(`/?collection=${encodeURIComponent(collection.id)}`);

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
    await deleteCollection(page, collection.id);
  }
});

async function postJson<T>(page: Page, url: string, body: unknown): Promise<T> {
  const res = await page.request.post(url, { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}

async function patchJson<T>(page: Page, url: string, body: unknown): Promise<T> {
  const res = await page.request.patch(url, { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}
