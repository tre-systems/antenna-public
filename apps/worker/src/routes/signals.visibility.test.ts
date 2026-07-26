import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/signals/:id visibility', () => {
  it('updates signal visibility when the source policy allows public display', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'public' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      updated: true,
      visibility: 'public',
      cleared_points: false,
    });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.visibility).toBe('public');
  });

  it('updates signal visibility when the source policy allows shared display', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'shared' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      updated: true,
      visibility: 'shared',
      cleared_points: false,
    });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.visibility).toBe('shared');
  });

  it('rejects shared and public visibility for sources that are not display eligible', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.update(schema.signals)
      .set({ templateId: 'market-history', title: 'BA.L yearly chart' })
      .where(eq(schema.signals.id, 'b1'))
      .run();

    const app = buildApp(OWNER_1);
    for (const visibility of ['shared', 'public'] as const) {
      const res = await app.request(
        '/api/signals/b1',
        {
          method: 'PATCH',
          body: JSON.stringify({ visibility }),
          headers: { 'content-type': 'application/json' },
        },
        env,
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        error: 'source_policy_blocked',
        reason: 'source_not_public_display_eligible',
        source_policy: {
          source_id: 'yahoo-finance-chart',
          public_display_eligible: false,
        },
      });
    }
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.visibility).toBe('private');
  });
});
