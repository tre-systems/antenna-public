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

export async function deleteCollection(page: Page, collectionId: string): Promise<void> {
  const res = await page.request.delete(`/api/collections/${encodeURIComponent(collectionId)}`);
  expect(res.ok()).toBeTruthy();
}

async function postJson<T = unknown>(page: Page, url: string, body: unknown): Promise<T> {
  const res = await page.request.post(url, { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}
