import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, seedBaseline, setup, type Drizzle } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/signals', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    seedBaseline(db);
  });

  it('returns the latest point per dimension signature', async () => {
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

    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{
      id: string;
      display: { title: string; source_label: string; source_url: string | null };
      points: Array<{
        value: number;
        observed_at: number;
        fetched_at: number;
        source_url: string | null;
        display: { label: string; source_url: string | null };
      }>;
      status: { last_ok_at: number | null };
    }> = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe('b1');
    expect(body[0]?.points).toHaveLength(1);
    expect(body[0]?.points[0]?.value).toBe(1.09);
    expect(body[0]?.points[0]?.observed_at).toBe(newer.getTime());
    expect(body[0]?.points[0]?.fetched_at).toBe(newerFetched.getTime());
    expect(body[0]?.points[0]?.source_url).toBe('https://example.test/source');
    expect(body[0]?.points[0]?.display).toEqual({
      label: 'EUR/USD',
      source_url: 'https://example.test/source',
    });
    expect(body[0]?.display).toEqual({
      title: 'EUR/USD',
      source_label: 'Frankfurter (ECB)',
      source_url: 'https://example.test/source',
    });
    expect(body[0]?.status.last_ok_at).toBe(newer.getTime());
  });

  it('returns null status fields when no signal_status row exists', async () => {
    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    const body: Array<{
      visibility: string;
      source_policy: {
        source_id: string;
        label: string;
        source_url: string;
        execution_mode: string;
        public_display_eligible: boolean;
      } | null;
      status: { last_ok_at: number | null; status: string | null };
      points: unknown[];
    }> = await res.json();
    expect(body[0]?.source_policy).toMatchObject({
      source_id: 'frankfurter-ecb',
      label: 'Frankfurter (ECB)',
      source_url: 'https://www.frankfurter.app/',
      execution_mode: 'public_cloud',
      public_display_eligible: true,
    });
    expect(body[0]?.visibility).toBe('private');
    expect(body[0]?.status.last_ok_at).toBeNull();
    expect(body[0]?.status.status).toBeNull();
    expect(body[0]?.points).toEqual([]);
  });

  it('returns server-resolved display metadata when no points carry a source URL', async () => {
    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    const body: Array<{
      display: { title: string; source_label: string; source_url: string | null };
    }> = await res.json();

    expect(body[0]?.display).toEqual({
      title: 'EUR/USD',
      source_label: 'Frankfurter (ECB)',
      source_url: 'https://www.frankfurter.app/?from=EUR&to=USD',
    });
  });
});
