import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_2, seedCollection, seedSignal, setup } from './collection-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/collection rejections', () => {
  it('rejects empty, malformed, and invalid layout bodies', async () => {
    const { db, env } = setup();
    seedCollection(db);
    const app = buildApp();

    const empty = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const malformed = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: '{',
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const invalidLayout = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'b1', x: 0, y: 0, w: 0, h: 1 }] },
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'invalid_body' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_body' });
    expect(invalidLayout.status).toBe(400);
    expect(await invalidLayout.json()).toEqual({ error: 'invalid_body' });
  });

  it('rejects layouts that reference unknown or cross-owner signals', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, 'b1', 'collection-1');
    seedCollection(db, OWNER_2);
    seedSignal(db, 'b2', 'collection-2');
    const app = buildApp();

    const unknown = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'missing', x: 0, y: 0, w: 4, h: 3 }] },
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const otherTenant = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'b2', x: 0, y: 0, w: 4, h: 3 }] },
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'invalid_layout_signals' });
    expect(otherTenant.status).toBe(400);
    expect(await otherTenant.json()).toEqual({ error: 'invalid_layout_signals' });

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(JSON.parse(row?.layout as unknown as string)).toEqual({
      version: 1,
      slots: [{ signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 }],
    });
  });
});
