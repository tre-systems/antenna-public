// Shared scaffolding for dispatch.test.ts.
// Not a test file (no .test.ts suffix) so vitest ignores it.
//
// The DDL literal mirrors drizzle/0001_init.sql + 0003_auth.sql. When the
// schema changes, update both.

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { vi } from 'vitest';
import * as schema from '../db/schema';

export type Sqlite = ReturnType<typeof Database>;
export type Drizzle = BetterSQLite3Database<typeof schema>;

export const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
  CREATE TABLE signal_points (
    signal_id text NOT NULL REFERENCES signals(id),
    fetched_at integer NOT NULL,
    observed_at integer NOT NULL,
    metric_key text NOT NULL,
    dimensions text,
    value real,
    value_text text,
    unit text,
    source_url text,
    raw_payload_id text,
    PRIMARY KEY (signal_id, observed_at, metric_key)
  );
  CREATE TABLE signal_status (
    signal_id text PRIMARY KEY NOT NULL REFERENCES signals(id),
    status text NOT NULL,
    last_ok_at integer,
    last_error text,
    last_manual_request_at integer,
    next_attempt_at integer,
    last_data_hash text,
    last_data_at integer,
    updated_at integer NOT NULL
  );
  CREATE TABLE signal_alerts (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    signal_id text NOT NULL REFERENCES signals(id),
    rule_id text NOT NULL,
    rule_label text NOT NULL,
    metric_key text NOT NULL,
    observed_at integer NOT NULL,
    triggered_at integer NOT NULL,
    value real NOT NULL,
    previous_value real NOT NULL,
    unit text,
    source_url text
  );
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
  CREATE TABLE account (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at integer,
    refresh_token_expires_at integer,
    scope text,
    password text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE upstream_snapshots (
    cache_key text PRIMARY KEY NOT NULL,
    template_id text NOT NULL,
    points text NOT NULL,
    fetched_at integer NOT NULL
  );
  CREATE TABLE user_collection_visits (
    user_id text NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id) ON DELETE cascade,
    last_seen_at integer NOT NULL,
    PRIMARY KEY (user_id, collection_id)
  );
`;

export type R2Stub = {
  readonly bucket: R2Bucket;
  readonly puts: Array<{ key: string; body: string }>;
};

export const makeR2 = (): R2Stub => {
  const puts: Array<{ key: string; body: string }> = [];
  const bucket = {
    put: vi.fn((key: string, body: string) => {
      puts.push({ key, body });
      return Promise.resolve(undefined);
    }),
  } as unknown as R2Bucket;
  return { bucket, puts };
};

export const makeSqlite = (): { sqlite: Sqlite; db: Drizzle } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) };
};
