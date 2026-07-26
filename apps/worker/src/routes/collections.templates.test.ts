import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import { buildApp, setup } from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('POST /api/collections from a registry template', () => {
  it('creates a collection from a registered collection template', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'My founder morning',
          description: 'Template-backed collection',
          template_id: 'founder-morning',
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      title: 'My founder morning',
      description: 'Template-backed collection',
      visibility: 'private',
      layout: null,
    });

    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all()
      .sort((a, b) => a.position - b.position);
    expect(signals.map((signal) => [signal.templateId, signal.title, signal.visibility])).toEqual([
      ['market-overview', 'Market overview', 'private'],
      ['github-trending', 'GitHub Trending', 'private'],
      ['aa-frontier', 'Frontier model comparison', 'private'],
      ['karpathy-jobs-snapshot', 'Karpathy jobs', 'private'],
      ['uk-economic-calendar', 'UK economic calendar', 'private'],
    ]);
    expect(JSON.parse(signals[2]?.config as unknown as string)).toEqual({ limit: 5 });

    const statuses = db
      .select()
      .from(schema.signalStatus)
      .all()
      .sort((a, b) => a.signalId.localeCompare(b.signalId));
    expect(statuses).toHaveLength(signals.length);
    expect(statuses.every((status) => status.status === 'loading')).toBe(true);
  });

  it('accepts templateId as a query parameter for template-backed creation', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections?templateId=ops-morning',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Ops collection' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all();
    expect(signals.map((signal) => signal.templateId)).toContain('cloudflare-incidents');
  });

  it('rejects unknown templates and externally unsafe template-backed creation', async () => {
    const { env } = setup();

    const unknown = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Unknown', template_id: 'missing-template' }),
      },
      env,
    );
    const unsafePublic = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Public investor watchlist',
          visibility: 'public',
          template_id: 'investor-watchlist',
        }),
      },
      env,
    );

    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'unknown_collection_template' });
    expect(unsafePublic.status).toBe(409);
    expect(await unsafePublic.json()).toEqual({
      error: 'source_policy_blocked',
      reason: 'source_not_public_display_eligible',
    });
  });
});
