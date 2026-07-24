import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { assertSessionUserWhitelisted, parseWhitelist } from './index';

type Drizzle = BetterSQLite3Database<typeof schema>;

const USER_DDL = `
  CREATE TABLE user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified integer DEFAULT 0 NOT NULL,
    image text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    first_seen_at integer,
    onboarded_at integer
  );
`;

const setup = (): Drizzle => {
  const sqlite = new Database(':memory:');
  sqlite.exec(USER_DDL);
  return drizzle(sqlite, { schema });
};

const insertUser = (db: Drizzle, id: string, email: string): void => {
  db.insert(schema.user)
    .values({
      id,
      name: 'Test User',
      email,
      emailVerified: true,
      image: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const cast = (db: Drizzle) => db as unknown as Parameters<typeof assertSessionUserWhitelisted>[0];

describe('parseWhitelist', () => {
  it('trims, lowercases, and drops empty entries', () => {
    const set = parseWhitelist(' A@B.com , c@d.com ,, ');
    expect([...set].sort()).toEqual(['a@b.com', 'c@d.com']);
  });

  it('returns an empty set when unset', () => {
    expect(parseWhitelist(undefined).size).toBe(0);
    expect(parseWhitelist('').size).toBe(0);
  });
});

describe('assertSessionUserWhitelisted', () => {
  it('resolves for a user whose email is whitelisted', async () => {
    const db = setup();
    insertUser(db, 'u1', 'member@example.com');
    await expect(
      assertSessionUserWhitelisted(cast(db), 'u1', parseWhitelist('member@example.com')),
    ).resolves.toBeUndefined();
  });

  it('matches case-insensitively', async () => {
    const db = setup();
    insertUser(db, 'u1', 'Member@Example.com');
    await expect(
      assertSessionUserWhitelisted(cast(db), 'u1', parseWhitelist('member@example.com')),
    ).resolves.toBeUndefined();
  });

  it('throws when the user was removed from the whitelist (de-whitelisted)', async () => {
    const db = setup();
    insertUser(db, 'u1', 'ex-member@example.com');
    // ex-member's account still exists, but the email is no longer allowed.
    await expect(
      assertSessionUserWhitelisted(cast(db), 'u1', parseWhitelist('someone-else@example.com')),
    ).rejects.toThrow(/allowlist/);
  });

  it('fails closed when the user id is unknown', async () => {
    const db = setup();
    await expect(
      assertSessionUserWhitelisted(cast(db), 'ghost', parseWhitelist('member@example.com')),
    ).rejects.toThrow(/allowlist/);
  });

  it('fails closed against an empty whitelist', async () => {
    const db = setup();
    insertUser(db, 'u1', 'member@example.com');
    await expect(assertSessionUserWhitelisted(cast(db), 'u1', parseWhitelist(''))).rejects.toThrow(
      /allowlist/,
    );
  });
});
