import { test, expect } from '@playwright/test';

test('collection toolbar does not expose manual signal creation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('collection-experience')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('signal-composer-open')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /track something/i })).toHaveCount(0);
});
