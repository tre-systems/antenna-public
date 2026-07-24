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

const openComposer = async (page: Page): Promise<void> => {
  const input = page.getByTestId('signal-composer-input');
  const onboardingAddSignal = page.getByTestId('onboarding-add-signal');
  await expect(
    page
      .locator(
        '[data-testid="signal-composer-input"], [data-testid="signal-composer-open"], [data-testid="onboarding-add-signal"]',
      )
      .first(),
  ).toBeVisible({ timeout: 10_000 });
  if (await onboardingAddSignal.isVisible()) {
    await onboardingAddSignal.click();
  }
  if (await input.isVisible()) return;
  await page
    .getByTestId('signal-composer-open')
    .click({ timeout: 5_000 })
    .catch(async (error: unknown) => {
      if (!(await input.isVisible())) throw error;
    });
  await expect(input).toBeVisible({ timeout: 10_000 });
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
  await expectNoSeriousA11yViolations(page, 'MCP token settings');
});

test('add-signal plan preview has no serious axe violations', async ({ page }) => {
  await page.goto('/');
  await openComposer(page);

  await page.getByTestId('signal-composer-input').fill('weather in Paris');
  await page.getByTestId('signal-composer-submit').click();
  await expect(page.getByTestId('plan-preview')).toBeVisible({ timeout: 15_000 });

  await expectNoSeriousA11yViolations(page, 'add-signal plan preview');
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

// Automates the manual narrow-viewport sweep (review Lens 7 / R6): the desktop
// projects above never exercise phone width, where the common regression is
// content wider than the viewport (horizontal scroll). 375px is the standard
// small-phone CSS width (e.g. iPhone SE).
test('collection fits a phone viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  // Anchor on the collection-experience shell, not a state-specific testid.
  // header-present is `hidden` below the sm breakpoint (invisible on a phone),
  // and onboarding-shell only renders while the shared e2e user is still in
  // onboarding — a parallel spec that creates a collection flips that user into
  // collection state mid-run, so waiting on it races. The collection-experience
  // <main> wraps both onboarding and collection state, carries no
  // responsive-hidden class, and is distinct from the bare loading/error
  // <main>s, so it's the one element reliably present and visible here at 375px.
  await expect(page.getByTestId('collection-experience')).toBeVisible({ timeout: 10_000 });

  // +1 absorbs sub-pixel rounding; anything beyond that is real overflow that
  // forces sideways scrolling on a phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow at 375px width').toBeLessThanOrEqual(1);

  await expectNoSeriousA11yViolations(page, 'collection (phone viewport)');
});
