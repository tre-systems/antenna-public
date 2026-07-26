import { expect, test, type Locator, type Page } from '@playwright/test';
import { createSeededCollection, deleteCollection } from './shared-fixture';

// Rendered titles of the six trader-morning signals, in seeded order.
const SEEDED_TITLES = [
  'Market overview',
  'GBP/USD',
  'Gold',
  'Crude oil',
  'Crypto history',
  'Stocks',
] as const;

test('drag moves a card anywhere in the grid and the order persists', async ({ page }) => {
  const collectionId = await createSeededCollection(page, 'reorder');

  try {
    await page.goto(`/?collection=${encodeURIComponent(collectionId)}`);

    const gold = page.locator('[data-signal-id]').filter({ hasText: 'Gold' });
    const watchlist = page.locator('[data-signal-id]').filter({ hasText: 'Stocks' });
    await expect(gold).toHaveCount(1, { timeout: 15_000 });
    await expect(watchlist).toHaveCount(1);

    const before = await gridOrder(page);
    const goldIdx = before.indexOf('Gold');
    const watchlistIdx = before.indexOf('Stocks');
    expect(goldIdx).toBeGreaterThanOrEqual(0);
    expect(watchlistIdx).toBeGreaterThan(goldIdx);

    // Drop Gold onto the watchlist card — a long-distance move across the
    // whole grid, not just a neighbour swap. The grid live-previews and
    // reflows during the drag, so the exact landing slot depends on the
    // pointer path; the contract is that Gold lands late in the order and
    // whatever the user saw on release is what persists.
    await dragByHandle(page, gold, watchlist);

    await expect.poll(async () => (await gridOrder(page)).indexOf('Gold')).toBeGreaterThan(goldIdx);
    const after = await gridOrder(page);
    expect(after).not.toEqual(before);

    // The grid reorders optimistically while the PATCH is still in flight, so
    // wait for the server to agree before reloading — otherwise the reload
    // races the write and reads back the pre-drag order. Compared by signal id
    // rather than title, since ids are what the write actually reorders.
    const settledIds = await gridSignalIds(page);
    await expect
      .poll(async () => (await serverSignalIds(page, collectionId)).join('|'))
      .toBe(settledIds.join('|'));

    // The order survives a reload, so the PATCH persisted server-side.
    await page.reload();
    await expect(page.locator('[data-signal-id]').filter({ hasText: 'Gold' })).toHaveCount(1, {
      timeout: 15_000,
    });
    expect(await gridOrder(page)).toEqual(after);
  } finally {
    await deleteCollection(page, collectionId);
  }
});

// Card titles across the whole grid, in DOM order.
async function gridOrder(page: Page): Promise<string[]> {
  const headers = await page
    .locator('[data-signal-id] [data-testid="signal-card-header"]')
    .allTextContents();
  return headers.map(
    (header) => SEEDED_TITLES.find((title) => header.includes(title)) ?? 'unknown',
  );
}

// Signal ids in DOM order — the identity the reorder write actually persists.
async function gridSignalIds(page: Page): Promise<string[]> {
  return await page
    .locator('[data-signal-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-signal-id') ?? ''));
}

// The same list as the server has it. `/api/signals` returns position order.
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
  // Several intermediate moves: the drag arms after a 6px threshold and
  // live-previews on each pointermove.
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(
      startX + ((endX - startX) * step) / 8,
      startY + ((endY - startY) * step) / 8,
    );
  }
  await page.mouse.up();
}
