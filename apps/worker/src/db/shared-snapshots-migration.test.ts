import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  fileURLToPath(
    String(new URL('../../drizzle/0002_shared_snapshots_and_indexes.sql', import.meta.url)),
  ),
  'utf8',
);

const createTables = `
  CREATE TABLE collections (id text PRIMARY KEY, owner_id text NOT NULL);
  CREATE TABLE signals (id text PRIMARY KEY, collection_id text NOT NULL, position integer NOT NULL);
  CREATE TABLE collection_plans (id text PRIMARY KEY, collection_id text NOT NULL);
  CREATE TABLE connector_requests (id text PRIMARY KEY, collection_id text);
  CREATE TABLE session (id text PRIMARY KEY, user_id text NOT NULL);
  CREATE TABLE account (id text PRIMARY KEY, user_id text NOT NULL, provider_id text NOT NULL, account_id text NOT NULL);
  CREATE TABLE verification (id text PRIMARY KEY, identifier text NOT NULL);
`;

const migrated = (): Database.Database => {
  const sqlite = new Database(':memory:');
  sqlite.exec(createTables);
  sqlite.exec(migrationSql);
  return sqlite;
};

const queryPlan = (sqlite: Database.Database, sql: string): string =>
  (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as ReadonlyArray<{ detail: string }>)
    .map((row) => row.detail)
    .join(' | ');

describe('0002 shared snapshots and indexes migration', () => {
  it('creates every index the hot paths depend on', () => {
    const names = (
      migrated()
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
        .all() as ReadonlyArray<{ name: string }>
    ).map((row) => row.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'collections_owner_id_idx',
        'signals_collection_position_idx',
        'collection_plans_collection_id_idx',
        'connector_requests_collection_id_idx',
        'session_user_id_idx',
        'account_user_id_idx',
        'account_provider_account_idx',
        'verification_identifier_idx',
      ]),
    );
  });

  it('is safe to re-apply', () => {
    const sqlite = migrated();
    expect(() => sqlite.exec(migrationSql)).not.toThrow();
  });

  it('turns the tenant-scoped reads into index lookups instead of table scans', () => {
    const sqlite = migrated();

    expect(queryPlan(sqlite, "SELECT id FROM collections WHERE owner_id = 'u1'")).toContain(
      'USING INDEX collections_owner_id_idx',
    );
    expect(
      queryPlan(
        sqlite,
        "SELECT s.id FROM signals s JOIN collections c ON c.id = s.collection_id WHERE c.owner_id = 'u1' ORDER BY s.position",
      ),
    ).toContain('signals_collection_position_idx');
    expect(queryPlan(sqlite, "SELECT id FROM verification WHERE identifier = 'state'")).toContain(
      'USING INDEX verification_identifier_idx',
    );
    expect(
      queryPlan(
        sqlite,
        "SELECT id FROM account WHERE provider_id = 'google' AND account_id = 'a1'",
      ),
    ).toContain('USING INDEX account_provider_account_idx');
  });
});
