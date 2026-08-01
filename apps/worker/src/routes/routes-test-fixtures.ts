// Keep this in-memory route-test DDL aligned with the Worker migrations.

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import type { SessionUser } from '../auth/middleware';

export type Sqlite = ReturnType<typeof Database>;
export type Drizzle = BetterSQLite3Database<typeof schema>;

export { inMemoryDbClient } from '../cron/test-db';

export const OWNER_1: SessionUser = { id: 'owner-1', email: 'one@test', name: 'One' };
export const OWNER_2: SessionUser = { id: 'owner-2', email: 'two@test', name: 'Two' };

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
  CREATE TABLE user_collection_visits (
    user_id text NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    last_seen_at integer NOT NULL,
    PRIMARY KEY (user_id, collection_id)
  );
  CREATE TABLE collection_template_publications (
    collection_id text PRIMARY KEY NOT NULL REFERENCES collections(id),
    label text NOT NULL,
    description text,
    summary text NOT NULL,
    published_by text NOT NULL,
    published_at integer NOT NULL,
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
  CREATE TABLE notification_prefs (
    user_id text NOT NULL,
    scope text NOT NULL,
    collection_id text REFERENCES collections(id),
    channel text NOT NULL,
    enabled integer DEFAULT false NOT NULL,
    frequency text DEFAULT 'daily' NOT NULL,
    quiet_hours_start text,
    quiet_hours_end text,
    updated_at integer NOT NULL,
    PRIMARY KEY (user_id, scope, channel)
  );
  CREATE TABLE notification_deliveries (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    channel text NOT NULL,
    period_start integer NOT NULL,
    period_end integer NOT NULL,
    sent_at integer,
    status text NOT NULL,
    error text
  );
  CREATE TABLE dismissed_starter_signals (
    collection_id text NOT NULL REFERENCES collections(id),
    signal_signature text NOT NULL,
    dismissed_at integer NOT NULL,
    PRIMARY KEY (collection_id, signal_signature)
  );
  CREATE TABLE collection_plans (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    prompt text NOT NULL,
    proposed text NOT NULL,
    status text DEFAULT 'proposed' NOT NULL,
    created_at integer NOT NULL,
    resolved_at integer
  );
  CREATE TABLE plan_confirmation_claims (
    plan_id text PRIMARY KEY NOT NULL REFERENCES collection_plans(id) ON DELETE cascade,
    claimed_at integer NOT NULL
  );
  CREATE TABLE connector_requests (
    id text PRIMARY KEY NOT NULL,
    collection_id text REFERENCES collections(id),
    prompt text NOT NULL,
    requested_by text NOT NULL,
    notes text,
    status text DEFAULT 'requested' NOT NULL,
    created_at integer NOT NULL,
    resolved_at integer
  );
  CREATE TABLE public_collection_reports (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    category text NOT NULL,
    message text,
    requester_hash text NOT NULL,
    created_at integer NOT NULL
  );
`;

// Expose the SQLite handle through the mocked D1 binding.
export const setupRoutesDb = (): { db: Drizzle; env: { DB: D1Database } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  return {
    db: drizzle(sqlite, { schema }),
    env: { DB: { __sqlite: sqlite } as unknown as D1Database },
  };
};
