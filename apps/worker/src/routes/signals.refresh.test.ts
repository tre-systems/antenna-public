import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, seedOtherTenant, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('POST /api/signals/:id/refresh', () => {
  it('sets last_manual_request_at on the existing status row', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: new Date(1_000),
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp();
    const before = Date.now();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ requested: true });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    const manual = status[0]?.lastManualRequestAt;
    expect(manual).toBeInstanceOf(Date);
    expect((manual as Date).getTime()).toBeGreaterThanOrEqual(before);
    // The dispatcher refetches only when lastManualRequestAt > updatedAt
    // (its proxy for "last attempt"). Touching updatedAt here would defeat
    // that, so the refresh backstop must leave it alone on the existing row.
    const updated = status[0]?.updatedAt;
    expect(updated).toBeInstanceOf(Date);
    expect((updated as Date).getTime()).toBe(1_000);
  });

  it('creates a loading status row when none exists', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(200);

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status).toHaveLength(1);
    expect(status[0]?.status).toBe('loading');
    expect(status[0]?.lastManualRequestAt).not.toBeNull();
  });

  it('rate limits repeated manual refresh requests for the same signal', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const lastManual = new Date(Date.now() - 10_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'loading',
        lastManualRequestAt: lastManual,
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).not.toBeNull();
    const body: {
      error: string;
      retry_after_seconds: number;
      limit: number;
      reset_at: number;
    } = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(body.limit).toBe(1);
    expect(body.retry_after_seconds).toBeGreaterThan(0);
    expect(body.retry_after_seconds).toBeLessThanOrEqual(60);
    expect(body.reset_at).toBe(Math.ceil((lastManual.getTime() + 60_000) / 1000));

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.lastManualRequestAt?.getTime()).toBe(lastManual.getTime());
    expect(status[0]?.updatedAt.getTime()).toBe(1_000);
  });

  it('allows another manual refresh after the per-signal window resets', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const oldManual = new Date(Date.now() - 61_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'loading',
        lastManualRequestAt: oldManual,
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp();
    const before = Date.now();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(200);

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.lastManualRequestAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(status[0]?.updatedAt.getTime()).toBe(1_000);
  });

  it('returns 404 and writes nothing when the signal belongs to another user', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    // OWNER_1 trying to refresh OWNER_2's signal id: must not leak existence.
    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b2'))
      .all();
    expect(status).toEqual([]);
  });

  it('returns 404 for an unknown signal id', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/does-not-exist/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(404);
  });
});
