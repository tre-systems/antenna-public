import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  fileURLToPath(String(new URL('../../drizzle/0001_initial.sql', import.meta.url))),
  'utf8',
);

describe('public initial migration', () => {
  it('creates the current schema without operator data', () => {
    const sqlite = new Database(':memory:');

    sqlite.exec(migrationSql);

    const objects = sqlite
      .prepare("SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string; type: string }>;
    expect(objects).toEqual(
      expect.arrayContaining([
        { name: 'collections', type: 'table' },
        { name: 'signals', type: 'table' },
        { name: 'signal_points', type: 'table' },
        { name: 'collection_plans', type: 'table' },
        { name: 'plan_confirmation_claims', type: 'table' },
        { name: 'oauth_access_token', type: 'table' },
        { name: 'plan_confirmation_claim_must_be_proposed', type: 'trigger' },
      ]),
    );

    for (const table of ['user', 'collections', 'signals', 'connector_requests']) {
      const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number;
      };
      expect(row.count).toBe(0);
    }
  });

  it('rejects a confirmation claim for a resolved plan', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(migrationSql);
    sqlite
      .prepare(
        'INSERT INTO collections (id, owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run('collection-1', 'user-1', 'Example', 1, 1);
    sqlite
      .prepare(
        'INSERT INTO collection_plans (id, collection_id, prompt, proposed, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('plan-1', 'collection-1', 'example', '[]', 'rejected', 1);

    expect(() =>
      sqlite
        .prepare('INSERT INTO plan_confirmation_claims (plan_id, claimed_at) VALUES (?, ?)')
        .run('plan-1', 1),
    ).toThrow(/plan is not proposed/);
  });
});
