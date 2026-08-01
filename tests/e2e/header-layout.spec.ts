import { expect, type Locator, test } from '@playwright/test';

async function boxFor(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) throw new Error('missing layout box');
  return box;
}

test('collection header controls do not overlap at narrow tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 724, height: 220 });
  await page.goto('/');

  const title = page.getByTestId('collection-title');
  const switcher = page.getByTestId('collection-switcher-trigger');
  const share = page.getByTestId('share-open');
  const present = page.getByTestId('header-present');
  const profile = page.getByTestId('profile-menu-trigger');

  await expect(profile).toBeVisible({ timeout: 10_000 });
  await expect(title).toBeVisible();
  await expect(switcher).toBeVisible();

  const [titleBox, switcherBox, shareBox, presentBox, profileBox] = await Promise.all([
    boxFor(title),
    boxFor(switcher),
    boxFor(share),
    boxFor(present),
    boxFor(profile),
  ]);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (viewport === null) throw new Error('missing viewport');

  expect(titleBox.width).toBeGreaterThan(44);
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(switcherBox.x - 4);
  expect(switcherBox.width).toBeLessThan(70);
  expect(shareBox.width).toBeLessThan(50);
  expect(presentBox.width).toBeLessThan(50);
  expect(profileBox.x + profileBox.width).toBeLessThanOrEqual(viewport.width);
  expect(Math.abs(titleBox.y - switcherBox.y)).toBeLessThan(12);
  expect(Math.abs(titleBox.y - profileBox.y)).toBeLessThan(12);
});

test('collection header uses labels once they fit', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 220 });
  await page.goto('/');

  const switcher = page.getByTestId('collection-switcher-trigger');
  const share = page.getByTestId('share-open');
  const present = page.getByTestId('header-present');
  const profile = page.getByTestId('profile-menu-trigger');

  await expect(profile).toBeVisible({ timeout: 10_000 });

  const [switcherBox, shareBox, presentBox, profileBox] = await Promise.all([
    boxFor(switcher),
    boxFor(share),
    boxFor(present),
    boxFor(profile),
  ]);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (viewport === null) throw new Error('missing viewport');

  expect(switcherBox.width).toBeGreaterThan(90);
  expect(shareBox.width).toBeGreaterThan(55);
  expect(presentBox.width).toBeGreaterThan(70);
  expect(profileBox.x + profileBox.width).toBeLessThanOrEqual(viewport.width);
  await expect(share).toContainText('Share');
});

test('collection header keeps controls on one row at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 220 });
  await page.goto('/');

  const title = page.getByTestId('collection-title');
  const titleText = title.locator('span');
  const switcher = page.getByTestId('collection-switcher-trigger');
  const share = page.getByTestId('share-open');
  const profile = page.getByTestId('profile-menu-trigger');

  await expect(profile).toBeVisible({ timeout: 10_000 });
  await expect(title).toBeVisible();
  await expect(titleText).toBeVisible();
  await expect(switcher).toBeVisible();

  const [titleBox, switcherBox, shareBox, profileBox] = await Promise.all([
    boxFor(title),
    boxFor(switcher),
    boxFor(share),
    boxFor(profile),
  ]);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (viewport === null) throw new Error('missing viewport');

  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(switcherBox.x - 4);
  expect(switcherBox.width).toBeLessThan(70);
  expect(shareBox.width).toBeLessThan(50);
  expect(profileBox.x + profileBox.width).toBeLessThanOrEqual(viewport.width);
  expect(Math.abs(titleBox.y - switcherBox.y)).toBeLessThan(12);
  expect(Math.abs(titleBox.y - profileBox.y)).toBeLessThan(12);
});
