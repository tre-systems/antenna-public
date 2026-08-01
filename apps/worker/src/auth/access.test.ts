import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { accessRules, assertSessionUserPermitted, emailPermitted, parseEmailList } from './access';

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

const cast = (db: Drizzle) => db as unknown as Parameters<typeof assertSessionUserPermitted>[0];

describe('parseEmailList', () => {
  it('trims, lowercases, and drops empty entries', () => {
    expect([...parseEmailList(' A@B.com , c@d.com ,, ')].sort()).toEqual(['a@b.com', 'c@d.com']);
  });

  it('returns an empty set when unset', () => {
    expect(parseEmailList(undefined).size).toBe(0);
    expect(parseEmailList('').size).toBe(0);
  });
});

describe('emailPermitted', () => {
  it('admits anyone when no allowlist is configured', () => {
    expect(emailPermitted(accessRules({}), 'stranger@example.com')).toBe(true);
  });

  it('admits only listed addresses once an allowlist is configured', () => {
    const rules = accessRules({ ALLOWED_EMAILS: 'member@example.com' });
    expect(emailPermitted(rules, 'member@example.com')).toBe(true);
    expect(emailPermitted(rules, 'stranger@example.com')).toBe(false);
  });

  it('refuses a blocked address, and blocked wins over allowed', () => {
    const blockedOnly = accessRules({ BLOCKED_EMAILS: 'spammer@example.com' });
    expect(emailPermitted(blockedOnly, 'spammer@example.com')).toBe(false);

    const bothLists = accessRules({
      ALLOWED_EMAILS: 'spammer@example.com',
      BLOCKED_EMAILS: 'spammer@example.com',
    });
    expect(emailPermitted(bothLists, 'spammer@example.com')).toBe(false);
  });

  it('matches regardless of case and surrounding whitespace', () => {
    const rules = accessRules({ ALLOWED_EMAILS: 'Member@Example.com' });
    expect(emailPermitted(rules, ' member@example.COM ')).toBe(true);
  });
});

describe('assertSessionUserPermitted', () => {
  it('resolves for a permitted user', async () => {
    const db = setup();
    insertUser(db, 'u1', 'member@example.com');
    await expect(
      assertSessionUserPermitted(cast(db), 'u1', accessRules({})),
    ).resolves.toBeUndefined();
  });

  it('cuts off a returning user once they leave a configured allowlist', async () => {
    const db = setup();
    insertUser(db, 'u1', 'ex-member@example.com');
    await expect(
      assertSessionUserPermitted(
        cast(db),
        'u1',
        accessRules({ ALLOWED_EMAILS: 'someone@example.com' }),
      ),
    ).rejects.toThrow(/not_invited/);
  });

  it('cuts off a newly blocked user', async () => {
    const db = setup();
    insertUser(db, 'u1', 'Spammer@Example.com');
    await expect(
      assertSessionUserPermitted(
        cast(db),
        'u1',
        accessRules({ BLOCKED_EMAILS: 'spammer@example.com' }),
      ),
    ).rejects.toThrow(/blocked/i);
  });

  it('fails closed when the user id is unknown', async () => {
    const db = setup();
    await expect(assertSessionUserPermitted(cast(db), 'ghost', accessRules({}))).rejects.toThrow(
      /unknown user/i,
    );
  });
});
