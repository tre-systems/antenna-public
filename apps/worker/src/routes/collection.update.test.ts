import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_2, seedCollection, seedSignal, setup } from './collection-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/collection', () => {
  it('updates the caller collection title, description, and layout', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db);
    seedCollection(db, OWNER_2);
    const layout = { version: 1, slots: [{ signal_id: 'b1', x: 2, y: 3, w: 6, h: 4 }] };

    const res = await buildApp().request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Morning collection',
          description: 'Daily operating view',
          layout,
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: 'collection-1',
      title: 'Morning collection',
      description: 'Daily operating view',
      layout,
    });
    const [own] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    const [other] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-2'))
      .all();
    expect(own?.title).toBe('Morning collection');
    expect(JSON.parse(own?.layout as unknown as string)).toEqual(layout);
    expect(other?.title).toBe('Other Collection');
  });

  it('clears nullable fields without replacing untouched fields', async () => {
    const { db, env } = setup();
    seedCollection(db);

    const res = await buildApp().request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ description: null, layout: null }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      title: 'Antenna',
      description: null,
      layout: null,
    });
    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(row?.description).toBeNull();
    expect(row?.layout).toBeNull();
  });

  it('revokes and rotates the share slug across a private transition', async () => {
    const { db, env } = setup();
    seedCollection(db);
    const app = buildApp();

    const shared = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'shared' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(shared.status).toBe(200);
    const sharedBody: { visibility: string; slug: string | null } = await shared.json();
    expect(sharedBody.visibility).toBe('shared');
    expect(sharedBody.slug).toMatch(/^[a-f0-9]{32}$/);

    const privateAgain = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'private' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const publicAgain = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'public' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(privateAgain.status).toBe(200);
    expect(publicAgain.status).toBe(200);
    const privateBody: { visibility: string; slug: string | null } = await privateAgain.json();
    const publicBody: { visibility: string; slug: string | null } = await publicAgain.json();
    expect(privateBody).toMatchObject({ visibility: 'private', slug: null });
    expect(publicBody.visibility).toBe('public');
    expect(publicBody.slug).toMatch(/^[a-f0-9]{32}$/);
    expect(publicBody.slug).not.toBe(sharedBody.slug);

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(row?.visibility).toBe('public');
    expect(row?.slug).toBe(publicBody.slug);
  });
});
