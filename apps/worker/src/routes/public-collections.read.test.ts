import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, seedCollection, seedSignal, setup } from './public-collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

// Owner-only signal fields must never reach anonymous readers.
const OWNER_ONLY_PUBLIC_KEYS = [
  'config',
  'refresh_seconds',
  'collection_id',
  'position',
  'created_at',
  'updated_at',
  'raw_payload_id',
];

const expectPublicSignalContract = (signal: Record<string, unknown>): void => {
  for (const key of OWNER_ONLY_PUBLIC_KEYS) {
    expect(signal).not.toHaveProperty(key);
  }
  const points = Array.isArray(signal.points) ? signal.points : [];
  for (const point of points) {
    expect(point).not.toHaveProperty('raw_payload_id');
  }
};

describe('GET /api/public/collections/:slug', () => {
  it('returns 404 for unknown, private, or shared collections without requiring auth', async () => {
    const { db, env } = setup();
    seedCollection(db, { visibility: 'private', slug: 'private-slug' });
    seedCollection(db, { id: 'collection-2', visibility: 'shared', slug: 'shared-slug' });
    const app = buildApp();

    const unknown = await app.request('/api/public/collections/missing', undefined, env);
    const privateCollection = await app.request(
      '/api/public/collections/private-slug',
      undefined,
      env,
    );
    const sharedCollection = await app.request(
      '/api/public/collections/shared-slug',
      undefined,
      env,
    );

    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'not_found' });
    expect(privateCollection.status).toBe(404);
    expect(await privateCollection.json()).toEqual({ error: 'not_found' });
    expect(sharedCollection.status).toBe(404);
    expect(await sharedCollection.json()).toEqual({ error: 'not_found' });
  });

  it('returns only public-display eligible public signals and strips owner-only fields', async () => {
    const { db, env } = setup();
    seedCollection(db, { layoutSignalIds: ['public-fx', 'private-fx', 'blocked-market'] });
    seedSignal(db, { id: 'public-fx', templateId: 'fx-pair', visibility: 'public', position: 0 });
    seedSignal(db, { id: 'private-fx', templateId: 'fx-pair', visibility: 'private', position: 1 });
    seedSignal(db, {
      id: 'blocked-market',
      templateId: 'market-history',
      visibility: 'public',
      position: 2,
    });
    const observedAt = new Date(1_700_000_000_000);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'public-fx',
        fetchedAt: observedAt,
        observedAt,
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
        sourceUrl: 'https://example.test/fx',
      })
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'public-fx',
        status: 'live',
        lastOkAt: observedAt,
        updatedAt: observedAt,
      })
      .run();

    const res = await buildApp().request('/api/public/collections/public-slug', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      collection: {
        id: string;
        visibility: string;
        slug: string | null;
        layout: { slots: Array<{ signal_id: string }> } | null;
      };
      signals: Array<Record<string, unknown> & { id: string; points: Array<{ value: number }> }>;
    } = await res.json();
    expect(body.collection).toMatchObject({
      id: 'collection-1',
      visibility: 'public',
      slug: 'public-slug',
    });
    expect(body.collection.layout?.slots.map((slot) => slot.signal_id)).toEqual(['public-fx']);
    expect(body.signals.map((signal) => signal.id)).toEqual(['public-fx']);
    for (const signal of body.signals) expectPublicSignalContract(signal);
    expect(body.signals[0]?.points[0]?.value).toBe(1.09);

    const [privateSignal] = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.id, 'private-fx'))
      .all();
    expect(privateSignal?.visibility).toBe('private');
  });

  it('redacts the raw adapter error from status for anonymous readers', async () => {
    const { db, env } = setup();
    seedCollection(db, { layoutSignalIds: ['public-fx'] });
    seedSignal(db, { id: 'public-fx', templateId: 'fx-pair', visibility: 'public', position: 0 });
    const at = new Date(1_700_000_000_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'public-fx',
        status: 'stale',
        lastOkAt: at,
        lastError: 'FETCH_FAILED: upstream https://internal.example/v1/quote returned 500',
        updatedAt: at,
      })
      .run();

    const res = await buildApp().request('/api/public/collections/public-slug', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      signals: Array<{ id: string; status: { status: string | null; last_error: string | null } }>;
    } = await res.json();
    const signal = body.signals.find((s) => s.id === 'public-fx');
    // The coarse health state stays visible so the UI can flag staleness…
    expect(signal?.status.status).toBe('stale');
    // …but the raw adapter error text must never reach anonymous readers.
    expect(signal?.status.last_error).toBeNull();
  });
});
