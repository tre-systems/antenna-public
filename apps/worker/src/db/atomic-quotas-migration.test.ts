import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(String(new URL('../../drizzle/0005_atomic_quotas.sql', import.meta.url))),
  'utf8',
);
const setup = () => {
  const sqlite = new Database(':memory:');
  sqlite.exec(`CREATE TABLE collections (id text PRIMARY KEY, owner_id text);
    CREATE TABLE signals (id text PRIMARY KEY, collection_id text);
    CREATE TABLE claims (id text PRIMARY KEY);`);
  return sqlite;
};
const seed = (sqlite: Database.Database, table: 'signals' | 'collections', count: number) => {
  const insert = sqlite.prepare(`INSERT INTO ${table} VALUES (?, 'owner')`);
  for (let i = 0; i < count; i += 1) insert.run(String(i));
};

describe('0005 atomic quota enforcement', () => {
  it.each([
    ['collections', 10],
    ['signals', 50],
  ] as const)('enforces %s capacity within the insert statement', (table, limit) => {
    const sqlite = setup();
    sqlite.exec(migration);
    seed(sqlite, table, limit);
    expect(() => sqlite.prepare(`INSERT INTO ${table} VALUES ('excess', 'owner')`).run()).toThrow(
      'quota_exceeded',
    );
    expect(sqlite.prepare(`SELECT count(*) FROM ${table}`).pluck().get()).toBe(limit);
    expect(() =>
      sqlite.prepare(`INSERT INTO ${table} VALUES ('other', 'other-owner')`).run(),
    ).not.toThrow();
  });
  it('preserves over-limit existing rows and allows deletion and ordinary updates', () => {
    const sqlite = setup();
    seed(sqlite, 'signals', 51);
    seed(sqlite, 'collections', 11);
    sqlite.exec(migration);
    expect(sqlite.prepare('SELECT count(*) FROM signals').pluck().get()).toBe(51);
    expect(sqlite.prepare('SELECT count(*) FROM collections').pluck().get()).toBe(11);
    sqlite.exec(
      "UPDATE signals SET id = 'updated' WHERE id = '0'; DELETE FROM signals WHERE id = '1';",
    );
    expect(sqlite.prepare('SELECT count(*) FROM signals').pluck().get()).toBe(50);
  });
  it('rolls back a whole confirmation transaction, including its claim and earlier inserts', () => {
    const sqlite = setup();
    sqlite.exec(migration);
    seed(sqlite, 'signals', 49);
    const confirm = sqlite.transaction(() =>
      sqlite.exec(`INSERT INTO claims VALUES ('plan');
      INSERT INTO signals VALUES ('new-a', 'owner');
      INSERT INTO signals VALUES ('new-b', 'owner');`),
    );
    expect(confirm).toThrow('signal_quota_exceeded');
    expect(sqlite.prepare('SELECT count(*) FROM signals').pluck().get()).toBe(49);
    expect(sqlite.prepare('SELECT count(*) FROM claims').pluck().get()).toBe(0);
  });
});
