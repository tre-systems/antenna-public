import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { runDailyDigests, type DigestEnv } from './digest';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

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

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const setup = (): { db: Drizzle; env: DigestEnv } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: {
      DB: { __sqlite: sqlite } as unknown as D1Database,
      RESEND_API_KEY: 'resend-key',
      NOTIFICATION_FROM_EMAIL: 'Antenna <digest@antenna.test>',
      BETTER_AUTH_URL: 'https://antenna.test',
    },
  };
};

const seedUser = (db: Drizzle): void => {
  db.insert(schema.user)
    .values({
      id: 'user-1',
      name: 'User',
      email: 'user@example.test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedCollection = (db: Drizzle, id = 'collection-1', ownerId = 'user-1'): void => {
  db.insert(schema.collections)
    .values({
      id,
      ownerId,
      title: id === 'collection-1' ? 'Morning Collection' : 'Other Collection',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignalAndAlert = (
  db: Drizzle,
  collectionId = 'collection-1',
  signalId = `signal-${collectionId}`,
): void => {
  db.insert(schema.signals)
    .values({
      id: signalId,
      collectionId,
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
      id: `alert-${collectionId}`,
      collectionId,
      signalId,
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'pair=EUR/USD',
      observedAt: new Date(Date.parse('2026-05-25T05:00:00Z')),
      triggeredAt: new Date(Date.parse('2026-05-25T05:01:00Z')),
      value: 1.09,
      previousValue: 1.08,
      unit: 'USD',
      sourceUrl: 'https://frankfurter.dev/',
    })
    .run();
};

const seedPref = (
  db: Drizzle,
  opts: {
    readonly scope?: string;
    readonly collectionId?: string | null;
    readonly frequency?: 'daily' | 'weekly';
    readonly quietHoursStart?: string | null;
    readonly quietHoursEnd?: string | null;
  } = {},
): void => {
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

const digestWindow = Date.parse('2026-05-25T06:05:00Z');

describe('runDailyDigests', () => {
  it('sends one digest per collection with recent alerts and records delivery', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, digestWindow);
    const second = await runDailyDigests(env, digestWindow);

    expect(summary).toEqual({ considered: 1, sent: 1, skipped: 0, failed: 0 });
    expect(second).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    if (typeof init.body !== 'string') throw new Error('expected Resend request body to be JSON');
    const request = JSON.parse(init.body) as {
      readonly to: readonly string[];
      readonly subject: string;
      readonly text: string;
    };
    expect(request.to).toEqual(['user@example.test']);
    expect(request.subject).toBe('Antenna daily brief: Morning Collection');
    expect(request.text).toContain('EUR/USD');
    expect(request.text).toContain('Antenna daily brief for Morning Collection');
    expect(request.text).toContain('Open Antenna: https://antenna.test');
    expect(db.select().from(schema.notificationDeliveries).all()).toMatchObject([
      {
        id: 'user-1:collection-1:daily_digest:2026-05-25',
        userId: 'user-1',
        collectionId: 'collection-1',
        sentAt: new Date(digestWindow),
        status: 'sent',
        error: null,
      },
    ]);
  });

  it('skips sending outside the digest window', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, Date.parse('2026-05-25T08:00:00Z'));

    expect(summary).toEqual({ considered: 0, sent: 0, skipped: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send weekly preferences on non-weekly brief days', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db, { frequency: 'weekly' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, Date.parse('2026-05-26T06:05:00Z'));

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends weekly preferences on the weekly brief day with weekly copy', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db, { frequency: 'weekly' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, digestWindow);

    expect(summary).toEqual({ considered: 1, sent: 1, skipped: 0, failed: 0 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    if (typeof init.body !== 'string') throw new Error('expected Resend request body to be JSON');
    const request = JSON.parse(init.body) as { readonly subject: string; readonly text: string };
    expect(request.subject).toBe('Antenna weekly brief: Morning Collection');
    expect(request.text).toContain('Antenna weekly brief for Morning Collection');
    expect(db.select().from(schema.notificationDeliveries).all()).toMatchObject([
      {
        id: 'user-1:collection-1:daily_digest:weekly:2026-05-25',
        periodStart: new Date(digestWindow - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(digestWindow),
        sentAt: new Date(digestWindow),
        status: 'sent',
      },
    ]);
  });

  it('does not record a delivery when Resend is not configured', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests({ ...env, RESEND_API_KEY: undefined }, digestWindow);

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.select().from(schema.notificationDeliveries).all()).toEqual([]);
  });

  it('records a failed delivery when Resend cannot be reached', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db);
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, digestWindow);

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 0, failed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.select().from(schema.notificationDeliveries).all()).toMatchObject([
      {
        id: 'user-1:collection-1:daily_digest:2026-05-25',
        userId: 'user-1',
        collectionId: 'collection-1',
        status: 'error',
        error: 'resend_network: network down',
      },
    ]);
  });

  it('lets collection preferences override a global preference for the same collection', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db);
    seedSignalAndAlert(db);
    seedPref(db);
    seedPref(db, {
      scope: 'collection:collection-1',
      collectionId: 'collection-1',
      quietHoursStart: '06:00',
      quietHoursEnd: '08:00',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, digestWindow);

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
