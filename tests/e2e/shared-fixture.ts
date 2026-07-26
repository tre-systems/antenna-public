import { expect, type Page } from '@playwright/test';

type CollectionRecord = {
  readonly id: string;
  readonly slug: string | null;
};

type PlanRecord = {
  readonly id: string;
};

export type SharedFixture = {
  readonly collectionId: string;
  readonly slug: string;
};

export async function postJson<T = unknown>(page: Page, url: string, body: unknown): Promise<T> {
  const res = await page.request.post(url, { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}

export async function patchJson<T = unknown>(page: Page, url: string, body: unknown): Promise<T> {
  const res = await page.request.patch(url, { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}

export async function createSharedFixture(page: Page): Promise<SharedFixture> {
  const collection = await postJson<CollectionRecord>(page, '/api/collections', {
    title: `E2E shared ${Date.now()}`,
    visibility: 'shared',
  });
  expect(collection.slug).toBeTruthy();

  const plan = await postJson<PlanRecord>(page, '/api/plan', {
    collection_id: collection.id,
    prompt: 'track CHF/USD',
  });
  await postJson(page, `/api/plan/${encodeURIComponent(plan.id)}/confirm`, {});

  return { collectionId: collection.id, slug: collection.slug ?? '' };
}

/** Private collection seeded from the `trader-morning` template, with onboarding completed. */
export async function createSeededCollection(page: Page, label: string): Promise<string> {
  const collection = await postJson<CollectionRecord>(page, '/api/collections', {
    title: `E2E ${label} ${Date.now()}`,
    visibility: 'private',
    template_id: 'trader-morning',
  });
  await patchJson(page, '/api/me/onboarding', { completed: true });
  return collection.id;
}

export async function deleteCollection(page: Page, collectionId: string): Promise<void> {
  const res = await page.request.delete(`/api/collections/${encodeURIComponent(collectionId)}`);
  expect(res.ok()).toBeTruthy();
}

/** Reaches the composer input from either the onboarding shell or the collection header. */
export async function openSignalComposer(page: Page): Promise<void> {
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
}
