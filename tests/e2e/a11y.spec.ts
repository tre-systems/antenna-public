import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createSharedFixture, deleteCollection } from './shared-fixture';

const seriousOrCritical = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) =>
  violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

const formatViolations = (
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): string =>
  seriousOrCritical(violations)
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.join(' ')}`)
        .join('\n');
      return `${violation.id} (${violation.impact}): ${violation.help}\n${nodes}`;
    })
    .join('\n\n');

const expectNoSeriousA11yViolations = async (page: Page, label: string): Promise<void> => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = seriousOrCritical(results.violations);
  expect(
    blocking,
    `${label} accessibility violations:\n${formatViolations(results.violations)}`,
  ).toEqual([]);
};

test('signed-in collection and token settings have no serious axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('[data-testid="header-present"], [data-testid="onboarding-shell"]').first(),
  ).toBeVisible({
    timeout: 10_000,
  });
  await expectNoSeriousA11yViolations(page, 'collection');

  await page.goto('/settings/tokens');
  await expect(page.getByTestId('settings-connections-command')).toBeVisible({ timeout: 10_000 });
  await expectNoSeriousA11yViolations(page, 'agent access settings');
});

test('shared collection view has no serious axe violations', async ({ page }) => {
  const fixture = await createSharedFixture(page);

  try {
    await page.goto(`/c/${fixture.slug}`);
    await expect(page.getByTestId('public-grid')).toBeVisible({ timeout: 15_000 });

    await expectNoSeriousA11yViolations(page, 'shared collection');
  } finally {
    await deleteCollection(page, fixture.collectionId);
  }
});

test('collection fits a phone viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  // This shell is stable even when parallel specs complete onboarding for the shared user.
  await expect(page.getByTestId('collection-experience')).toBeVisible({ timeout: 10_000 });

  // One pixel absorbs sub-pixel layout rounding.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow at 375px width').toBeLessThanOrEqual(1);

  await expectNoSeriousA11yViolations(page, 'collection (phone viewport)');
});
