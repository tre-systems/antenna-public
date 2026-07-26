import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, seedOtherTenant, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/signals/:id/history', () => {
  it('returns owned history points in ascending timestamp order', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const older = new Date(Date.now() - 10 * 86_400_000);
    const newer = new Date(Date.now() - 2 * 86_400_000);
    const fetched = new Date();
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: fetched,
          observedAt: newer,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: fetched,
          observedAt: older,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.07,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=1m', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      signal_id: string;
      range: string;
      points: Array<{
        value: number;
        observed_at: number;
        fetched_at: number;
        display: { label: string; source_url: string | null };
      }>;
    } = await res.json();
    expect(body.signal_id).toBe('b1');
    expect(body.range).toBe('1m');
    expect(body.points.map((p) => p.value)).toEqual([1.07, 1.09]);
    expect(body.points.map((p) => p.observed_at)).toEqual([older.getTime(), newer.getTime()]);
    expect(body.points.map((p) => p.fetched_at)).toEqual([fetched.getTime(), fetched.getTime()]);
    expect(body.points.map((p) => p.display.label)).toEqual(['EUR/USD', 'EUR/USD']);
  });

  it('applies the requested range window', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const stale = new Date(Date.now() - 45 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: stale,
          observedAt: stale,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.01,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: recent,
          observedAt: recent,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=1m', undefined, env);
    const body: { points: Array<{ value: number }> } = await res.json();

    expect(body.points.map((p) => p.value)).toEqual([1.09]);
  });

  it('returns all owned history points when range is all', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const stale = new Date(Date.now() - 500 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: stale,
          observedAt: stale,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.01,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: recent,
          observedAt: recent,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=all', undefined, env);
    const body: { range: string; points: Array<{ value: number }> } = await res.json();

    expect(res.status).toBe(200);
    expect(body.range).toBe('all');
    expect(body.points.map((p) => p.value)).toEqual([1.01, 1.09]);
  });

  it('rejects unsupported history ranges', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=10y', undefined, env);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_query' });
  });

  it('returns 404 for a signal owned by another tenant', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2/history', undefined, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
