import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import type { Db } from '../db/client';
import { makeSqlite, type Drizzle, type Sqlite } from '../cron/dispatch-test-fixtures';
import {
  SIGNALS_PER_COLLECTION_LIMIT,
  countSignalsInCollection,
  signalQuotaFromCount,
  wouldExceedSignalQuota,
} from './quota';

let sqlite: Sqlite;
let db: Drizzle;

// The quota helpers target D1; better-sqlite3 stands in for it here.
const client = (): Db => db as unknown as Db;

const addCollection = (id: string): void => {
  db.insert(schema.collections)
    .values({
      id,
      ownerId: `owner-of-${id}`,
      title: id,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const addSignals = (collectionId: string, count: number): void => {
  addCollection(collectionId);
  for (let i = 0; i < count; i += 1) {
    db.insert(schema.signals)
      .values({
        id: `${collectionId}-signal-${String(i)}`,
        collectionId,
        templateId: 'manual-metric',
        title: `signal ${String(i)}`,
        config: JSON.stringify({}) as unknown as schema.SignalConfig,
        refreshSeconds: 3600,
        position: i,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
  }
};

beforeEach(() => {
  sqlite = makeSqlite().sqlite;
  db = drizzle(sqlite, { schema });
});

describe('signalQuotaFromCount', () => {
  it('reports remaining headroom and stops at the limit', () => {
    expect(signalQuotaFromCount(0)).toEqual({
      used: 0,
      limit: SIGNALS_PER_COLLECTION_LIMIT,
      remaining: SIGNALS_PER_COLLECTION_LIMIT,
      can_create: true,
    });

    const full = signalQuotaFromCount(SIGNALS_PER_COLLECTION_LIMIT);
    expect(full.can_create).toBe(false);
    expect(full.remaining).toBe(0);
  });

  it('never reports negative headroom when a collection is already over', () => {
    expect(signalQuotaFromCount(SIGNALS_PER_COLLECTION_LIMIT + 5).remaining).toBe(0);
  });
});

describe('wouldExceedSignalQuota', () => {
  it('counts only the target collection', async () => {
    addSignals('collection-1', 3);
    addSignals('collection-2', 2);

    await expect(countSignalsInCollection(client(), 'collection-1')).resolves.toBe(3);
    await expect(wouldExceedSignalQuota(client(), 'collection-1', 1)).resolves.toBe(false);
  });

  it('rejects the batch that would cross the limit rather than the one after it', async () => {
    addSignals('collection-1', SIGNALS_PER_COLLECTION_LIMIT - 2);

    await expect(wouldExceedSignalQuota(client(), 'collection-1', 2)).resolves.toBe(false);
    await expect(wouldExceedSignalQuota(client(), 'collection-1', 3)).resolves.toBe(true);
  });

  it('allows a no-op confirmation on a full collection', async () => {
    addSignals('collection-1', SIGNALS_PER_COLLECTION_LIMIT);

    await expect(wouldExceedSignalQuota(client(), 'collection-1', 0)).resolves.toBe(false);
    await expect(wouldExceedSignalQuota(client(), 'collection-1', 1)).resolves.toBe(true);
  });
});
