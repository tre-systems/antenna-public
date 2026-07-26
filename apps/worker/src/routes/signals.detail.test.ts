import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, seedOtherTenant, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/signals/:id', () => {
  it('returns one owned signal with display, source policy, status, and latest points', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const older = new Date(1_700_000_000_000);
    const newer = new Date(1_700_000_100_000);
    const newerFetched = new Date(1_700_000_200_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: older,
          observedAt: older,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.07,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: newerFetched,
          observedAt: newer,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
          sourceUrl: 'https://example.test/source',
        },
      ])
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: newer,
        updatedAt: newer,
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b1', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      id: string;
      display: { title: string; source_label: string; source_url: string | null };
      source_policy: { source_id: string; public_display_eligible: boolean } | null;
      points: Array<{
        value: number;
        observed_at: number;
        fetched_at: number;
        source_url: string | null;
        display: { label: string; source_url: string | null };
      }>;
      status: { status: string | null; last_ok_at: number | null };
    } = await res.json();
    expect(body.id).toBe('b1');
    expect(body.display).toEqual({
      title: 'EUR/USD',
      source_label: 'Frankfurter (ECB)',
      source_url: 'https://example.test/source',
    });
    expect(body.source_policy).toMatchObject({
      source_id: 'frankfurter-ecb',
      public_display_eligible: true,
    });
    expect(body.points).toHaveLength(1);
    expect(body.points[0]?.value).toBe(1.09);
    expect(body.points[0]?.observed_at).toBe(newer.getTime());
    expect(body.points[0]?.fetched_at).toBe(newerFetched.getTime());
    expect(body.points[0]?.display).toEqual({
      label: 'EUR/USD',
      source_url: 'https://example.test/source',
    });
    expect(body.status).toMatchObject({ status: 'live', last_ok_at: newer.getTime() });
  });

  it('returns 404 for a signal owned by another tenant', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2', undefined, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
