import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/signals/:id', () => {
  it('updates owned signal config, clears stale points/status, and returns the validated config', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_700_000_000_000),
        observedAt: new Date(1_700_000_000_000),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
      })
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: new Date(1_000),
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'GBP' }, refresh_seconds: 600 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      updated: true,
      config: { base: 'GBP', quote: 'USD' },
      refresh_seconds: 600,
      visibility: 'private',
      cleared_points: true,
    });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'GBP', quote: 'USD' });
    expect(signal?.refreshSeconds).toBe(600);
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toEqual([]);
    expect(
      db.select().from(schema.signalStatus).where(eq(schema.signalStatus.signalId, 'b1')).all(),
    ).toEqual([]);
  });

  it('updates refresh interval without clearing current points', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_700_000_000_000),
        observedAt: new Date(1_700_000_000_000),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ refresh_seconds: 1200 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: { cleared_points: boolean } = await res.json();
    expect(body.cleared_points).toBe(false);
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toHaveLength(1);
  });

  it('does not clear current data for a no-op config patch', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_000),
        observedAt: new Date(1_000),
        metricKey: 'pair=EUR/USD',
        value: 1.09,
      })
      .run();

    const res = await buildApp(OWNER_1).request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'EUR' } }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ cleared_points: false });
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toHaveLength(1);
  });

  it('removes optional config keys patched to null', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.update(schema.signals)
      .set({
        templateId: 'cloudflare-analytics',
        config: JSON.stringify({
          account_id: '0123456789abcdef0123456789abcdef',
          days: 7,
        }) as unknown as schema.SignalConfig,
      })
      .where(eq(schema.signals.id, 'b1'))
      .run();

    const res = await buildApp(OWNER_1).request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { days: null } }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      config: { account_id: '0123456789abcdef0123456789abcdef' },
      cleared_points: true,
    });
  });

  it('clamps refresh interval edits to the server-owned cadence window', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const app = buildApp(OWNER_1);

    const tooFast = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ refresh_seconds: 1 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const tooSlow = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ refresh_seconds: 999_999_999 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(tooFast.status).toBe(200);
    expect(await tooFast.json()).toMatchObject({ refresh_seconds: 60 });
    expect(tooSlow.status).toBe(200);
    expect(await tooSlow.json()).toMatchObject({ refresh_seconds: 604_800 });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.refreshSeconds).toBe(604_800);
  });
});
