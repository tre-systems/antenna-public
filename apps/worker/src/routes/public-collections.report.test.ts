import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { requesterMetadataHash } from './public-collection-helpers';
import { buildApp, seedCollection, setup } from './public-collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('requesterMetadataHash', () => {
  const request = (): Request =>
    new Request('https://antenna.example/api/public/collections/x/report', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.10', 'User-Agent': 'Vitest' },
    });

  it('is deterministic for the same secret and metadata', async () => {
    const a = await requesterMetadataHash(request(), 'shared-secret');
    const b = await requesterMetadataHash(request(), 'shared-secret');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is keyed: a different secret yields a different hash (not plain SHA-256)', async () => {
    const withKeyA = await requesterMetadataHash(request(), 'secret-a');
    const withKeyB = await requesterMetadataHash(request(), 'secret-b');
    expect(withKeyA).not.toBe(withKeyB);

    // Guard against a regression back to an unkeyed digest an attacker could
    // recompute from IP + UA alone.
    const plain = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('203.0.113.10\nVitest'),
    );
    const plainHex = [...new Uint8Array(plain)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(withKeyA).not.toBe(plainHex);
  });
});

describe('POST /api/public/collections/:slug/report', () => {
  it('stores a report for a public collection with hashed requester metadata', async () => {
    const { db, env } = setup();
    seedCollection(db);

    const res = await buildApp().request(
      '/api/public/collections/public-slug/report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10',
          'User-Agent': 'Vitest',
        },
        body: JSON.stringify({ category: 'broken', message: 'Chart looks stale.' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: { id: string; created_at: number } = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
    expect(body.created_at).toBeGreaterThan(0);

    const [report] = db.select().from(schema.publicCollectionReports).all();
    expect(report).toMatchObject({
      id: body.id,
      collectionId: 'collection-1',
      category: 'broken',
      message: 'Chart looks stale.',
    });
    expect(report?.requesterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report?.requesterHash).not.toContain('203.0.113.10');
  });

  it('rejects invalid bodies and non-public collections', async () => {
    const { db, env } = setup();
    seedCollection(db, { visibility: 'private', slug: 'private-slug' });

    const invalid = await buildApp().request(
      '/api/public/collections/private-slug/report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'abuse' }),
      },
      env,
    );
    const privateCollection = await buildApp().request(
      '/api/public/collections/private-slug/report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'inappropriate' }),
      },
      env,
    );

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_body' });
    expect(privateCollection.status).toBe(404);
    expect(await privateCollection.json()).toEqual({ error: 'not_found' });
    expect(db.select().from(schema.publicCollectionReports).all()).toEqual([]);
  });
});
