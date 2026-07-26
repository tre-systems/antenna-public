// Deployment adoption counts feed the owner-only `antenna-users` signal. The
// two things that matter: the numbers are right, and only an admin's signal can
// ever obtain them.

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import type { Db } from '../db/client';
import { makeSqlite, type Drizzle, type Sqlite } from '../cron/dispatch-test-fixtures';
import { isAdminEmail, isAdminUser, parseAdminEmails } from '../policy/admin';
import { readDeploymentStats } from './deployment-stats';

const NOW = 1_800_000_000_000;
const DAY_MS = 86_400_000;

let sqlite: Sqlite;
let db: Drizzle;

const client = (): Db => db as unknown as Db;

const addUser = (id: string, email: string, createdAtMs: number): void => {
  db.insert(schema.user)
    .values({
      id,
      name: id,
      email,
      emailVerified: true,
      createdAt: new Date(createdAtMs),
      updatedAt: new Date(createdAtMs),
    })
    .run();
};

const addCollection = (id: string, ownerId: string): void => {
  db.insert(schema.collections)
    .values({ id, ownerId, title: id, createdAt: new Date(0), updatedAt: new Date(0) })
    .run();
};

const addVisit = (userId: string, collectionId: string, lastSeenAtMs: number): void => {
  db.insert(schema.userCollectionVisits)
    .values({ userId, collectionId, lastSeenAt: new Date(lastSeenAtMs) })
    .run();
};

beforeEach(() => {
  sqlite = makeSqlite().sqlite;
  db = drizzle(sqlite, { schema });
});

describe('readDeploymentStats', () => {
  it('counts signups by age and activity by recent visit', async () => {
    addUser('old', 'old@example.test', NOW - 30 * DAY_MS);
    addUser('this-week', 'week@example.test', NOW - 3 * DAY_MS);
    addUser('today', 'today@example.test', NOW - 2 * 3_600_000);
    addCollection('collection-old', 'old');
    addCollection('collection-today', 'today');
    addVisit('old', 'collection-old', NOW - 30 * DAY_MS);
    addVisit('today', 'collection-today', NOW - 3_600_000);

    await expect(readDeploymentStats(client(), NOW)).resolves.toEqual({
      total_users: 3,
      new_users_24h: 1,
      new_users_7d: 2,
      active_users_7d: 1,
      collections: 2,
      signals: 0,
    });
  });

  it('reports zeroes on an empty deployment rather than failing', async () => {
    await expect(readDeploymentStats(client(), NOW)).resolves.toEqual({
      total_users: 0,
      new_users_24h: 0,
      new_users_7d: 0,
      active_users_7d: 0,
      collections: 0,
      signals: 0,
    });
  });
});

describe('admin policy', () => {
  it('parses, trims, and lowercases the configured list', () => {
    expect(parseAdminEmails(' Owner@Example.test , second@example.test ,, ')).toEqual(
      new Set(['owner@example.test', 'second@example.test']),
    );
    expect(parseAdminEmails(undefined)).toEqual(new Set());
  });

  it('matches an admin email case-insensitively', () => {
    const env = { ADMIN_EMAILS: 'owner@example.test' };
    expect(isAdminEmail(env, 'Owner@Example.test ')).toBe(true);
    expect(isAdminEmail(env, 'someone@example.test')).toBe(false);
  });

  it('resolves an admin from a user id', async () => {
    addUser('admin-user', 'owner@example.test', NOW);
    addUser('normal-user', 'someone@example.test', NOW);
    const env = { ADMIN_EMAILS: 'owner@example.test' };

    await expect(isAdminUser(client(), env, 'admin-user')).resolves.toBe(true);
    await expect(isAdminUser(client(), env, 'normal-user')).resolves.toBe(false);
  });

  it('fails closed for an unknown user and for an unset admin list', async () => {
    addUser('admin-user', 'owner@example.test', NOW);

    await expect(
      isAdminUser(client(), { ADMIN_EMAILS: 'owner@example.test' }, 'ghost'),
    ).resolves.toBe(false);
    await expect(isAdminUser(client(), {}, 'admin-user')).resolves.toBe(false);
  });
});
