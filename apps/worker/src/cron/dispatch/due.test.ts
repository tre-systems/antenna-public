// Keep dispatch selection SQL-backed, bounded, and fair.

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../db/schema';
import { makeSqlite, type Drizzle, type Sqlite } from '../dispatch-test-fixtures';
import { DISPATCH_TICK_LIMIT, loadDueDispatchRows } from './due';
import type { Client } from './types';

const NOW = 10_000_000;

let sqlite: Sqlite;
let db: Drizzle;

const client = (): Client => db as unknown as Client;

const addCollection = (id: string, refreshMode: 'scheduled' | 'on_demand' = 'scheduled'): void => {
  db.insert(schema.collections)
    .values({
      id,
      ownerId: `owner-of-${id}`,
      title: id,
      refreshMode,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const addSignal = (id: string, collectionId: string, refreshSeconds = 60): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId,
      templateId: 'manual-metric',
      title: id,
      config: JSON.stringify({}) as unknown as schema.SignalConfig,
      refreshSeconds,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const addStatus = (
  signalId: string,
  partial: {
    lastOkAt?: number;
    lastManualRequestAt?: number;
    nextAttemptAt?: number;
    updatedAt: number;
  },
): void => {
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: partial.lastOkAt === undefined ? null : new Date(partial.lastOkAt),
      lastManualRequestAt:
        partial.lastManualRequestAt === undefined ? null : new Date(partial.lastManualRequestAt),
      nextAttemptAt: partial.nextAttemptAt === undefined ? null : new Date(partial.nextAttemptAt),
      updatedAt: new Date(partial.updatedAt),
    })
    .run();
};

const dueIds = async (limit?: number): Promise<string[]> =>
  (await loadDueDispatchRows(client(), NOW, limit)).map((row) => row.signal.id);

beforeEach(() => {
  const made = makeSqlite();
  sqlite = made.sqlite;
  db = drizzle(sqlite, { schema });
  addCollection('collection-1');
});

describe('loadDueDispatchRows', () => {
  it('selects a signal that has never been dispatched', async () => {
    addSignal('never-run', 'collection-1');
    await expect(dueIds()).resolves.toEqual(['never-run']);
  });

  it('leaves a signal alone until its refresh interval has elapsed', async () => {
    addSignal('fresh', 'collection-1', 3600);
    addStatus('fresh', { lastOkAt: NOW - 60_000, updatedAt: NOW - 60_000 });
    await expect(dueIds()).resolves.toEqual([]);

    addSignal('elapsed', 'collection-1', 60);
    addStatus('elapsed', { lastOkAt: NOW - 120_000, updatedAt: NOW - 120_000 });
    await expect(dueIds()).resolves.toEqual(['elapsed']);
  });

  it('honours retry backoff', async () => {
    addSignal('backing-off', 'collection-1');
    addStatus('backing-off', { nextAttemptAt: NOW + 60_000, updatedAt: NOW - 600_000 });
    await expect(dueIds()).resolves.toEqual([]);
  });

  it('skips on-demand collections but still honours their manual refreshes', async () => {
    addCollection('collection-on-demand', 'on_demand');
    addSignal('idle', 'collection-on-demand');
    addStatus('idle', { lastOkAt: NOW - 600_000, updatedAt: NOW - 600_000 });
    await expect(dueIds()).resolves.toEqual([]);

    addSignal('asked-for', 'collection-on-demand');
    addStatus('asked-for', { updatedAt: NOW - 600_000, lastManualRequestAt: NOW - 1_000 });
    await expect(dueIds()).resolves.toEqual(['asked-for']);
  });

  it('puts manual refreshes ahead of the scheduled queue', async () => {
    addSignal('scheduled-oldest', 'collection-1');
    addStatus('scheduled-oldest', { updatedAt: 0 });
    addSignal('manual', 'collection-1');
    addStatus('manual', { updatedAt: NOW - 1_000, lastManualRequestAt: NOW - 500 });

    await expect(dueIds()).resolves.toEqual(['manual', 'scheduled-oldest']);
  });

  it('orders by least-recently-attempted so no collection starves', async () => {
    addCollection('collection-2');
    addSignal('attempted-recently', 'collection-1');
    addStatus('attempted-recently', { updatedAt: NOW - 60_000 });
    addSignal('attempted-long-ago', 'collection-2');
    addStatus('attempted-long-ago', { updatedAt: NOW - 600_000 });
    addSignal('never-attempted', 'collection-2');

    await expect(dueIds()).resolves.toEqual([
      'never-attempted',
      'attempted-long-ago',
      'attempted-recently',
    ]);
  });

  it('rotates a permanently failing signal to the back instead of starving others', async () => {
    // Do not let null last_ok_at pin a failing signal to the queue front.
    addSignal('always-failing', 'collection-1');
    addStatus('always-failing', { updatedAt: NOW - 1_000, nextAttemptAt: NOW - 500 });
    addSignal('healthy', 'collection-1');
    addStatus('healthy', { lastOkAt: NOW - 600_000, updatedAt: NOW - 600_000 });

    await expect(dueIds()).resolves.toEqual(['healthy', 'always-failing']);
  });

  it('caps one tick regardless of how much work is due', async () => {
    for (let i = 0; i < 12; i += 1) addSignal(`signal-${String(i)}`, 'collection-1');

    await expect(dueIds(5)).resolves.toHaveLength(5);
    expect(DISPATCH_TICK_LIMIT).toBeGreaterThan(0);
  });
});
