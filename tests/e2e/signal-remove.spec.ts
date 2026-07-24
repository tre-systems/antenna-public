import { expect, test, type Page } from '@playwright/test';
import { deleteCollection } from './shared-fixture';

type CollectionRecord = {
  readonly id: string;
};

test('hover quick-remove hides the card and undo restores it', async ({ page }) => {
  const collection = await postJson<CollectionRecord>(page, '/api/collections', {
    title: `E2E remove ${Date.now()}`,
    visibility: 'private',
    template_id: 'trader-morning',
  });
  await patchJson(page, '/api/me/onboarding', { completed: true });

  try {
    await page.goto(`/?collection=${encodeURIComponent(collection.id)}`);

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
    await deleteCollection(page, collection.id);
  }
});

async function postJson<T>(page: Page, url: string, body: unknown): Promise<T> {
  const res = await page.request.post(url, { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}

async function patchJson(page: Page, url: string, body: unknown): Promise<void> {
  const res = await page.request.patch(url, { data: body });
  expect(res.ok()).toBeTruthy();
}
