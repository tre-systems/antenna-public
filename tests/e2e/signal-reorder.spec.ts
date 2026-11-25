import { expect, test, type Locator, type Page } from '@playwright/test';
import { createSeededCollection, deleteCollection } from './shared-fixture';

test('drag moves a card anywhere in the grid and the order persists', async ({ page }) => {
  const collectionId = await createSeededCollection(page, 'reorder');

  try {
    await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);

    const gold = page.locator('[data-signal-id]').filter({ hasText: 'Gold' });
    const qqq = page.locator('[data-signal-id]').filter({ hasText: 'QQQ 1Y' });
    await expect(gold).toHaveCount(1, { timeout: 15_000 });
    await expect(qqq).toHaveCount(1);

    const before = await gridSignalIds(page);
    const goldId = (await gold.getAttribute('data-signal-id')) ?? '';
    const goldIdx = before.indexOf(goldId);
    const qqqIdx = before.indexOf((await qqq.getAttribute('data-signal-id')) ?? '');
    expect(goldIdx).toBeGreaterThanOrEqual(0);
    expect(qqqIdx).toBeGreaterThan(goldIdx);

    // The landing slot follows the live preview, so assert a later position rather than an index.
    const orderPath = `/api/collections/${encodeURIComponent(collectionId)}/signals/order`;
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname === orderPath,
      ),
      dragByHandle(page, gold, qqq),
    ]);
    expect(saved.ok()).toBe(true);
    const { ordered_signal_ids: order } = (await saved.json()) as { ordered_signal_ids: string[] };
    expect([...order].sort()).toEqual([...before].sort());
    expect(order.indexOf(goldId)).toBeGreaterThan(goldIdx);
    await expect.poll(() => gridSignalIds(page)).toEqual(order);

    const [read] = await Promise.all([
      page.waitForRequest((r) => {
        const url = new URL(r.url());
        return (
          r.method() === 'GET' &&
          url.pathname === '/api/signals' &&
          url.searchParams.get('collection_id') === collectionId
        );
      }),
      page.reload(),
    ]);
    const fresh = await read.response();
    if (!fresh) throw new Error('The collection reload received no response');
    expect(fresh.ok()).toBe(true);
    const signals = (await fresh.json()) as { id: string }[];
    expect(signals.map((s) => s.id)).toEqual(order);
    // A cached grid can render before the fresh collection read completes.
    await expect.poll(() => gridSignalIds(page), { timeout: 15_000 }).toEqual(order);
  } finally {
    await deleteCollection(page, collectionId);
  }
});

async function gridSignalIds(page: Page): Promise<string[]> {
  return await page
    .locator('[data-signal-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-signal-id') ?? ''));
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
