import { expect, test, type Locator, type Page } from '@playwright/test';
import { createSeededCollection, deleteCollection } from './shared-fixture';

const SEEDED_TITLES = [
  'Market overview',
  'GBP/USD',
  'Gold',
  'Crude oil',
  'Crypto history',
  'VTI 1Y',
  'SPY 1Y',
  'QQQ 1Y',
] as const;

test('drag moves a card anywhere in the grid and the order persists', async ({ page }) => {
  const collectionId = await createSeededCollection(page, 'reorder');

  try {
    await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);

    const gold = page.locator('[data-signal-id]').filter({ hasText: 'Gold' });
    const qqq = page.locator('[data-signal-id]').filter({ hasText: 'QQQ 1Y' });
    await expect(gold).toHaveCount(1, { timeout: 15_000 });
    await expect(qqq).toHaveCount(1);

    const before = await gridOrder(page);
    const goldIdx = before.indexOf('Gold');
    const qqqIdx = before.indexOf('QQQ 1Y');
    expect(goldIdx).toBeGreaterThanOrEqual(0);
    expect(qqqIdx).toBeGreaterThan(goldIdx);

    // The landing slot follows the live preview, so assert a later position rather than an index.
    await dragByHandle(page, gold, qqq);

    await expect.poll(async () => (await gridOrder(page)).indexOf('Gold')).toBeGreaterThan(goldIdx);
    const after = await gridOrder(page);
    expect(after).not.toEqual(before);

    // Wait for the optimistic order to persist before reloading.
    const settledIds = await gridSignalIds(page);
    await expect
      .poll(async () => (await serverSignalIds(page, collectionId)).join('|'))
      .toBe(settledIds.join('|'));

    await page.reload();
    await expect(page.locator('[data-signal-id]').filter({ hasText: 'Gold' })).toHaveCount(1, {
      timeout: 15_000,
    });
    expect(await gridOrder(page)).toEqual(after);
  } finally {
    await deleteCollection(page, collectionId);
  }
});

async function gridOrder(page: Page): Promise<string[]> {
  const headers = await page
    .locator('[data-signal-id] [data-testid="signal-card-header"]')
    .allTextContents();
  return headers.map(
    (header) => SEEDED_TITLES.find((title) => header.includes(title)) ?? 'unknown',
  );
}

async function gridSignalIds(page: Page): Promise<string[]> {
  return await page
    .locator('[data-signal-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-signal-id') ?? ''));
}

async function serverSignalIds(page: Page, collectionId: string): Promise<string[]> {
  const res = await page.request.get(
    `/api/signals?collection_id=${encodeURIComponent(collectionId)}`,
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as ReadonlyArray<{ id: string }>;
  return body.map((signal) => signal.id);
}

async function dragByHandle(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.hover();
  const handle = source.locator('[data-testid^="signal-drag-handle-"]');
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox) throw new Error('drag geometry unavailable');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Intermediate moves exercise the armed drag and its live preview.
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(
      startX + ((endX - startX) * step) / 8,
      startY + ((endY - startY) * step) / 8,
    );
  }
  await page.mouse.up();
}
