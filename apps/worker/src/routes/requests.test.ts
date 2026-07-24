import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { ConnectorRequestRecord } from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import { requestsRoute } from './requests';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const SCHEMA_DDL = `
  CREATE TABLE collections (
    id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL,
    title text NOT NULL,
    description text,
    visibility text DEFAULT 'private' NOT NULL,
    refresh_mode text DEFAULT 'scheduled' NOT NULL,
    slug text UNIQUE,
    forked_from_collection_id text,
    layout text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE connector_requests (
    id text PRIMARY KEY NOT NULL,
    collection_id text REFERENCES collections(id),
    prompt text NOT NULL,
    requested_by text NOT NULL,
    notes text,
    status text DEFAULT 'requested' NOT NULL,
    created_at integer NOT NULL,
    resolved_at integer
  );
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const setup = (): { db: Drizzle; env: { DB: D1Database }; app: Hono<{ Variables: AuthVars }> } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: 'user-1',
      title: 'Test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();

  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/requests/*', async (c, next) => {
    c.set('user', { id: 'user-1', email: 'user@test.local', name: 'User' });
    await next();
  });
  app.route('/api/requests', requestsRoute);
  return { db, env: { DB: { __sqlite: sqlite } as unknown as D1Database }, app };
};

describe('GET /api/requests', () => {
  it('aggregates by fragment and sorts by count then recency', async () => {
    const { db, env, app } = setup();
    const popular = 'gold price';
    const rare = 'silver futures';
    const at = (ms: number) => new Date(ms);

    db.insert(schema.connectorRequests)
      .values([
        {
          id: 'r1',
          collectionId: 'collection-1',
          prompt: popular,
          requestedBy: 'user-1',
          notes: 'gold price',
          createdAt: at(1_000),
        },
        {
          id: 'r2',
          collectionId: 'collection-1',
          prompt: popular,
          requestedBy: 'user-1',
          notes: 'gold price daily',
          createdAt: at(2_000),
        },
        {
          id: 'r3',
          collectionId: 'collection-1',
          prompt: popular,
          requestedBy: 'user-1',
          notes: 'gold price weekly',
          createdAt: at(3_000),
        },
        {
          id: 'r4',
          collectionId: 'collection-1',
          prompt: rare,
          requestedBy: 'user-1',
          notes: 'silver futures',
          createdAt: at(5_000),
        },
      ])
      .run();

    const res = await app.request('/api/requests', undefined, env);
    expect(res.status).toBe(200);
    const body: ConnectorRequestRecord[] = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]?.fragment).toBe(popular);
    expect(body[0]?.count).toBe(3);
    expect(body[1]?.fragment).toBe(rare);
    expect(body[1]?.count).toBe(1);
  });

  it('adds setup metadata for known unsupported sources', async () => {
    const { db, env, app } = setup();
    db.insert(schema.connectorRequests)
      .values({
        id: 'r1',
        collectionId: 'collection-1',
        prompt: 'https://tradingeconomics.com/commodity/gold',
        requestedBy: 'user-1',
        notes: 'gold and oil from Trading Economics',
        createdAt: new Date(1_000),
      })
      .run();

    const res = await app.request('/api/requests', undefined, env);
    const body: ConnectorRequestRecord[] = await res.json();
    expect(body[0]).toMatchObject({
      blocker_reason: 'source_rights_blocked',
      source_label: 'Trading Economics',
      source_url: 'https://tradingeconomics.com/',
      candidate_template_id: 'trading-economics-market',
      rights_status: 'needs-review',
    });
  });

  it('hides requests that have since been resolved or rejected', async () => {
    const { db, env, app } = setup();
    db.insert(schema.connectorRequests)
      .values([
        {
          id: 'open',
          collectionId: 'collection-1',
          prompt: 'https://finviz.com/',
          requestedBy: 'user-1',
          notes: 'finviz',
          status: 'requested',
          createdAt: new Date(1_000),
        },
        {
          id: 'available',
          collectionId: 'collection-1',
          prompt: 'terminal bench leaderboard',
          requestedBy: 'user-1',
          notes: 'terminal bench leaderboard',
          status: 'available',
          createdAt: new Date(2_000),
          resolvedAt: new Date(3_000),
        },
        {
          id: 'rejected',
          collectionId: 'collection-1',
          prompt: 'hows it going?',
          requestedBy: 'user-1',
          notes: 'hows it going?',
          status: 'rejected',
          createdAt: new Date(4_000),
          resolvedAt: new Date(5_000),
        },
      ])
      .run();

    const res = await app.request('/api/requests', undefined, env);
    const body: ConnectorRequestRecord[] = await res.json();
    expect(body.map((request) => request.fragment)).toEqual(['https://finviz.com/']);
  });

  it('returns an empty array when no requests exist', async () => {
    const { env, app } = setup();
    const res = await app.request('/api/requests', undefined, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('does not leak another collection owner connector requests', async () => {
    const { db, env, app } = setup();
    db.insert(schema.collections)
      .values({
        id: 'collection-2',
        ownerId: 'user-2',
        title: 'Other',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.connectorRequests)
      .values([
        {
          id: 'own',
          collectionId: 'collection-1',
          prompt: 'https://finviz.com/',
          requestedBy: 'user-1',
          notes: 'finviz',
          createdAt: new Date(1_000),
        },
        {
          id: 'other',
          collectionId: 'collection-2',
          prompt: 'private source',
          requestedBy: 'user-2',
          notes: 'private source',
          createdAt: new Date(2_000),
        },
      ])
      .run();

    const res = await app.request('/api/requests', undefined, env);
    const body: ConnectorRequestRecord[] = await res.json();
    expect(body.map((item) => item.fragment)).toEqual(['https://finviz.com/']);
  });
});
