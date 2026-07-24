import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { ensureUserCollection } from './index';

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
`;

const setup = (): Drizzle => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  return drizzle(sqlite, { schema });
};

const ensure = (client: Drizzle, userId: string): Promise<void> =>
  ensureUserCollection(client as unknown as Parameters<typeof ensureUserCollection>[0], userId);

describe('ensureUserCollection', () => {
  it('provisions one empty private collection for a new user', async () => {
    const client = setup();

    await ensure(client, 'user-1');

    const rows = client.select().from(schema.collections).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'primary-user-1',
      ownerId: 'user-1',
      title: 'Antenna',
      visibility: 'private',
    });
  });

  it('is idempotent when user and session hooks race', async () => {
    const client = setup();

    await Promise.all([ensure(client, 'user-1'), ensure(client, 'user-1')]);

    const rows = client
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, 'user-1'))
      .all();
    expect(rows).toHaveLength(1);
  });

  it('does not replace an existing collection', async () => {
    const client = setup();
    client
      .insert(schema.collections)
      .values({
        id: 'existing',
        ownerId: 'user-1',
        title: 'Existing collection',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    await ensure(client, 'user-1');

    expect(client.select().from(schema.collections).all()).toHaveLength(1);
    expect(client.select().from(schema.collections).all()[0]?.id).toBe('existing');
  });

  it('does not touch another user collection', async () => {
    const client = setup();
    client
      .insert(schema.collections)
      .values({
        id: 'other',
        ownerId: 'user-2',
        title: 'Other collection',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    await ensure(client, 'user-1');

    const rows = client.select().from(schema.collections).all();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.ownerId === 'user-2')?.id).toBe('other');
  });
});
