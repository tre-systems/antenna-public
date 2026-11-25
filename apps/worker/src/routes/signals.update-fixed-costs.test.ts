import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, OWNER_2, seedBaseline, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

const config = {
  amount: 0,
  currency: 'USD',
  provider: 'Cloudflare',
  service: 'All services',
  period: 'month_to_date',
};
const snapshot = { amount: 5, fixedFees: 5, usageOverages: 0, asOf: '2026-10-31T10:00:00Z' };

function fixture() {
  const result = setup();
  seedBaseline(result.db);
  result.db
    .update(schema.signals)
    .set({
      templateId: 'manual-cost',
      config: JSON.stringify(config) as unknown as schema.SignalConfig,
    })
    .where(eq(schema.signals.id, 'b1'))
    .run();
  return result;
}

const patch = (values: Record<string, unknown>): RequestInit => ({
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ config: values }),
});

describe('fixed fee snapshots', () => {
  it('persists the total, fee, usage, and observation date without changing other config or policy', async () => {
    const { db, env } = fixture(),
      app = buildApp(OWNER_1);
    const result = await app.request('/api/signals/b1', patch(snapshot), env);
    expect(result.status).toBe(200);
    const read = await app.request('/api/signals/b1', {}, env);
    await expect(read.json()).resolves.toMatchObject({
      config: { ...config, ...snapshot },
      visibility: 'private',
      refresh_seconds: 900,
    });
    const [stored] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(JSON.parse(stored?.config as unknown as string)).toEqual({ ...config, ...snapshot });
  });

  it('rejects incomplete, negative or mismatched components and cross-owner edits', async () => {
    const { env } = fixture(),
      app = buildApp(OWNER_1);
    for (const values of [
      { fixedFees: 5 },
      { ...snapshot, amount: 0 },
      { ...snapshot, fixedFees: -1 },
      { ...snapshot, usageOverages: '0' },
    ]) {
      expect((await app.request('/api/signals/b1', patch(values), env)).status).toBe(400);
    }
    expect((await buildApp(OWNER_2).request('/api/signals/b1', patch(snapshot), env)).status).toBe(
      404,
    );
    const read = await app.request('/api/signals/b1', {}, env);
    await expect(read.json()).resolves.toMatchObject({ config });
  });
});
