// Shared scaffolding for digest.test.ts.
// Not a test file (no .test.ts suffix) so vitest ignores it.
//
// The DDL literal mirrors the digest slice of the Drizzle schema. When those
// tables change, update both.

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import type { DigestEnv } from './digest';

export type Drizzle = BetterSQLite3Database<typeof schema>;

export const DIGEST_WINDOW_MS = Date.parse('2026-05-25T06:05:00Z');

const SCHEMA_DDL = `
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
    user_id text NOT NULL REFERENCES user(id),
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
    user_id text NOT NULL REFERENCES user(id),
    collection_id text NOT NULL REFERENCES collections(id),
    channel text NOT NULL,
    period_start integer NOT NULL,
    period_end integer NOT NULL,
    sent_at integer,
    status text NOT NULL,
    error text
  );
`;

export type PrefOptions = {
  readonly scope?: string;
  readonly collectionId?: string | null;
  readonly frequency?: 'daily' | 'weekly';
  readonly quietHoursStart?: string | null;
  readonly quietHoursEnd?: string | null;
};

export const setup = (): { db: Drizzle; env: DigestEnv } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  return {
    db: drizzle(sqlite, { schema }),
    env: {
      DB: { __sqlite: sqlite } as unknown as D1Database,
      RESEND_API_KEY: 'resend-key',
      NOTIFICATION_FROM_EMAIL: 'Antenna <digest@antenna.test>',
      BETTER_AUTH_URL: 'https://antenna.test',
    },
  };
};

// One owner with one alerting collection and a digest preference — the shape
// every digest case starts from.
export const seedDigestCandidate = (db: Drizzle, pref: PrefOptions = {}): void => {
  db.insert(schema.user)
    .values({
      id: 'user-1',
      name: 'User',
      email: 'user@example.test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: 'user-1',
      title: 'Morning Collection',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  seedSignalAndAlert(db);
  seedPref(db, pref);
};

export const seedPref = (db: Drizzle, opts: PrefOptions = {}): void => {
  db.insert(schema.notificationPrefs)
    .values({
      userId: 'user-1',
      scope: opts.scope ?? 'global',
      collectionId: opts.collectionId ?? null,
      channel: 'daily_digest',
      enabled: true,
      frequency: opts.frequency ?? 'daily',
      quietHoursStart: opts.quietHoursStart ?? null,
      quietHoursEnd: opts.quietHoursEnd ?? null,
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignalAndAlert = (db: Drizzle): void => {
  db.insert(schema.signals)
    .values({
      id: 'signal-collection-1',
      collectionId: 'collection-1',
      templateId: 'fx-pair',
      title: 'EUR/USD',
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  db.insert(schema.signalAlerts)
    .values({
      id: 'alert-collection-1',
      collectionId: 'collection-1',
      signalId: 'signal-collection-1',
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'pair=EUR/USD',
      observedAt: new Date(Date.parse('2026-05-25T05:00:00Z')),
      triggeredAt: new Date(Date.parse('2026-05-25T05:01:00Z')),
      value: 1.09,
      previousValue: 1.08,
      unit: 'USD',
      sourceUrl: 'https://www.frankfurter.app/',
    })
    .run();
};
