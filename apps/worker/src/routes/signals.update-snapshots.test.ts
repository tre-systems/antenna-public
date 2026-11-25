import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, OWNER_2, seedBaseline, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

const snapshot = {
  amount: 2.004321,
  currency: 'GBP',
  period: 'month_to_date',
  provider: 'Google Cloud',
  service: 'All services',
  topUps: 16,
  asOf: '2026-10-31T06:00:00Z',
  periodMonth: '2026-10',
  creditBalance: -0.01,
  creditBalanceAsOf: '2026-10-30T10:00:00Z',
};

const setupCostSignal = () => {
  const result = setup();
  seedBaseline(result.db);
  result.db
    .update(schema.signals)
    .set({
      templateId: 'manual-cost',
      config: JSON.stringify(snapshot) as unknown as schema.SignalConfig,
    })
    .where(eq(schema.signals.id, 'b1'))
    .run();
  return result;
};

const patchRequest = (config: Record<string, unknown>): RequestInit => ({
  method: 'PATCH',
  body: JSON.stringify({ config }),
  headers: { 'content-type': 'application/json' },
});

describe('manual cost snapshot updates', () => {
  it('persists snapshot fields through PATCH, storage, and a fresh GET without changing cadence or privacy', async () => {
    const { db, env } = setupCostSignal();
    const app = buildApp(OWNER_1);
    const patch = {
      amount: 3.125678,
      topUps: 24,
      asOf: '2026-10-31T08:00:00Z',
      periodMonth: '2026-10',
      creditBalance: 7.25,
      creditBalanceAsOf: '2026-10-31T08:10:00Z',
    };
    const expected = { ...snapshot, ...patch };
    const res = await app.request('/api/signals/b1', patchRequest(patch), env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      updated: true,
      config: expected,
      refresh_seconds: 900,
      visibility: 'private',
      cleared_points: true,
    });
    const [stored] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(JSON.parse(stored?.config as unknown as string)).toEqual(expected);
    const read = await app.request('/api/signals/b1', {}, env);
    await expect(read.json()).resolves.toMatchObject({
      config: expected,
      refresh_seconds: 900,
      visibility: 'private',
    });
  });

  it('preserves independent credit balance and date when only the export snapshot advances', async () => {
    const { env } = setupCostSignal();
    const app = buildApp(OWNER_1);
    const patch = { amount: 4, topUps: 32, asOf: '2026-11-01T01:00:00Z', periodMonth: '2026-11' };
    const res = await app.request('/api/signals/b1', patchRequest(patch), env);

    expect(res.status).toBe(200);
    const read = await app.request('/api/signals/b1', {}, env);
    await expect(read.json()).resolves.toMatchObject({ config: { ...snapshot, ...patch } });
  });

  it.each([
    { topUps: -1 },
    { creditBalance: 'not a number' },
    { asOf: 'yesterday' },
    { creditBalanceAsOf: 'tomorrow' },
    { periodMonth: '2026-13' },
  ])(
    'rejects invalid snapshot fields without modifying the last good config: %j',
    async (patch) => {
      const { env } = setupCostSignal();
      const app = buildApp(OWNER_1);
      const res = await app.request('/api/signals/b1', patchRequest(patch), env);

      expect(res.status).toBe(400);
      const read = await app.request('/api/signals/b1', {}, env);
      await expect(read.json()).resolves.toMatchObject({ config: snapshot });
    },
  );

  it('does not let another owner change a cost snapshot', async () => {
    const { db, env } = setupCostSignal();
    const res = await buildApp(OWNER_2).request(
      '/api/signals/b1',
      patchRequest({ amount: 0, topUps: 0, creditBalance: 100 }),
      env,
    );

    expect(res.status).toBe(404);
    const [stored] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(JSON.parse(stored?.config as unknown as string)).toEqual(snapshot);
  });
});
