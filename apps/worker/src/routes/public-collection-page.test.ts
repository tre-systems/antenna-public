import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { Visibility } from '../policy/source-access';
import { publicCollectionPageRoute } from './public-collection-page';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;
type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

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
  CREATE TABLE signals (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    template_id text NOT NULL,
    title text NOT NULL,
    config text NOT NULL,
    refresh_seconds integer NOT NULL,
    position integer NOT NULL,
    visibility text DEFAULT 'private' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
`;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Antenna</title>
  </head>
  <body><div id="app"></div></body>
</html>`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const setup = (): {
  db: Drizzle;
  env: { DB: D1Database; ASSETS: AssetFetcher; BETTER_AUTH_URL: string };
} => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: {
      DB: { __sqlite: sqlite } as unknown as D1Database,
      ASSETS: {
        fetch: () =>
          Promise.resolve(new Response(INDEX_HTML, { headers: { 'content-type': 'text/html' } })),
      },
      BETTER_AUTH_URL: 'https://antenna.example.test',
    },
  };
};

const buildApp = (): Hono => {
  const app = new Hono();
  app.route('/c', publicCollectionPageRoute);
  return app;
};

const seedCollection = (
  db: Drizzle,
  opts: {
    readonly title?: string;
    readonly description?: string | null;
    readonly visibility?: Visibility;
    readonly slug?: string | null;
  } = {},
): void => {
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: 'owner-1',
      title: opts.title ?? 'Public collection',
      description: opts.description === undefined ? 'Morning view' : opts.description,
      visibility: opts.visibility ?? 'public',
      slug: opts.slug ?? 'public-slug',
      layout: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly templateId: string;
    readonly visibility: Visibility;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: 'collection-1',
      templateId: opts.templateId,
      title: opts.id,
      config:
        opts.templateId === 'fx-pair'
          ? (JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig)
          : (JSON.stringify({ symbol: 'BA.L' }) as unknown as schema.SignalConfig),
      refreshSeconds: 900,
      position: opts.position,
      visibility: opts.visibility,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

describe('GET /c/:slug', () => {
  it('injects public collection share metadata into the SPA shell', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, { id: 'safe-card', templateId: 'fx-pair', visibility: 'public', position: 0 });
    seedSignal(db, {
      id: 'private-card',
      templateId: 'fx-pair',
      visibility: 'private',
      position: 1,
    });
    seedSignal(db, {
      id: 'blocked-card',
      templateId: 'market-history',
      visibility: 'public',
      position: 2,
    });

    const res = await buildApp().request('/c/public-slug', undefined, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<title>Public collection | Antenna</title>');
    expect(html).toContain('<meta property="og:title" content="Public collection | Antenna" />');
    expect(html).toContain(
      '<meta property="og:url" content="https://antenna.example.test/c/public-slug" />',
    );
    expect(html).toContain('Morning view Includes 1 shareable live signal.');
    expect(html).toContain('<meta property="og:site_name" content="Antenna" />');
    expect(html).toContain('<div id="app"></div>');
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('serves the unchanged SPA shell when the collection is not public', async () => {
    const { db, env } = setup();
    seedCollection(db, { visibility: 'private', slug: 'private-slug' });

    const res = await buildApp().request('/c/private-slug', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX_HTML);
  });

  it('escapes title and description metadata', async () => {
    const { db, env } = setup();
    seedCollection(db, {
      title: 'Rob <Collection> & "Signals"',
      description: 'Live <macro> & "markets"',
    });

    const res = await buildApp().request('/c/public-slug', undefined, env);

    expect(await res.text()).toContain(
      '<meta property="og:title" content="Rob &lt;Collection&gt; &amp; &quot;Signals&quot; | Antenna" />',
    );
  });
});
