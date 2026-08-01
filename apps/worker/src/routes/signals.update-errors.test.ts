import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, seedOtherTenant, setup } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/signals/:id rejections', () => {
  it('rejects config patches that violate the template schema', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'GB' } }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid_config',
      detail: 'fx-pair config does not match registry schema',
    });
  });

  it('returns 404 and writes nothing when the signal belongs to another user', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b2',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'EUR' } }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b2')).all();
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'GBP', quote: 'USD' });
  });

  it('rejects empty or malformed patch bodies', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const empty = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const malformed = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: '{',
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'invalid_body' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_body' });
  });
});
