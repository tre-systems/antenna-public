// Smoke-test the shared schema against in-memory SQLite.

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { collections } from './schema';

const migration = (): string => {
  // Mirrors drizzle/0001_init.sql — kept minimal so the test stays hermetic.
  return `
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
};

describe('db client', () => {
  it('round-trips a collection row', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(migration());
    const db = drizzle(sqlite);

    const id = crypto.randomUUID();
    const now = new Date();

    db.insert(collections)
      .values({
        id,
        ownerId: 'user_test',
        title: 'Dogfood daily',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const [row] = db.select().from(collections).where(eq(collections.id, id)).all();

    expect(row?.id).toBe(id);
    // Spec calls this "name" colloquially; the column is `title` per ARCHITECTURE.md.
    expect(row?.title).toBe('Dogfood daily');
  });
});
