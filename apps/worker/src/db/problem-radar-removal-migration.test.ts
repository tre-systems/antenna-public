import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  fileURLToPath(String(new URL('../../drizzle/0003_remove_problem_radar.sql', import.meta.url))),
  'utf8',
);

describe('0003 problem radar removal migration', () => {
  it('removes retired signals and derived tables without touching other signals', () => {
    const sqlite = new Database(':memory:');
    createTables(sqlite);
    seedRows(sqlite);

    sqlite.exec(migrationSql);
    sqlite.exec(migrationSql);

    expect(sqlite.prepare('SELECT id FROM signals ORDER BY id').pluck().all()).toEqual(['keep']);
    expect(sqlite.prepare('SELECT signal_id FROM signal_alerts').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT signal_id FROM signal_points').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT signal_id FROM signal_status').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT signal_signature FROM dismissed_starter_signals').all()).toEqual([
      { signal_signature: 'fx-pair|{}' },
    ]);
    expect(tableNames(sqlite)).not.toContain('problem_clusters');
    expect(tableNames(sqlite)).not.toContain('problem_cluster_members');
  });
});

const tableNames = (sqlite: Database.Database): string[] =>
  sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all() as string[];

const createTables = (sqlite: Database.Database): void => {
  sqlite.exec(`
    CREATE TABLE signals (id text PRIMARY KEY NOT NULL, template_id text NOT NULL);
    CREATE TABLE signal_alerts (signal_id text NOT NULL);
    CREATE TABLE signal_points (signal_id text NOT NULL);
    CREATE TABLE signal_status (signal_id text PRIMARY KEY NOT NULL);
    CREATE TABLE dismissed_starter_signals (signal_signature text PRIMARY KEY NOT NULL);
    CREATE TABLE problem_clusters (id text PRIMARY KEY NOT NULL);
    CREATE TABLE problem_cluster_members (cluster_id text NOT NULL);
  `);
};

const seedRows = (sqlite: Database.Database): void => {
  sqlite.exec(`
    INSERT INTO signals VALUES ('remove', 'reddit-problems'), ('keep', 'fx-pair');
    INSERT INTO signal_alerts VALUES ('remove');
    INSERT INTO signal_points VALUES ('remove');
    INSERT INTO signal_status VALUES ('remove');
    INSERT INTO dismissed_starter_signals VALUES ('reddit-problems|{}'), ('fx-pair|{}');
  `);
};
