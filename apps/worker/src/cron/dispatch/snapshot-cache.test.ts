import { drizzle } from 'drizzle-orm/better-sqlite3';
import { templates } from '@antenna/registry';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../db/schema';
import { makeSqlite, type Drizzle, type Sqlite } from '../dispatch-test-fixtures';
import {
  isShareableTemplate,
  maxSnapshotAgeMs,
  purgeExpiredSnapshots,
  readSharedSnapshot,
  snapshotCacheKey,
  writeSharedSnapshot,
} from './snapshot-cache';
import type { Client, DispatchTemplate, SignalRow } from './types';

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

let sqlite: Sqlite;
let db: Drizzle;

const client = (): Client => db as unknown as Client;

const templateById = (id: string): DispatchTemplate => {
  const found = templates.find((template) => template.id === id);
  if (!found) throw new Error(`missing template fixture: ${id}`);
  return found;
};

const points = [{ dimensions: { metric: 'x' }, value: 1, ts: NOW }];

beforeEach(() => {
  sqlite = makeSqlite().sqlite;
  db = drizzle(sqlite, { schema });
});

describe('isShareableTemplate', () => {
  it('shares public-cloud sources, which depend only on their config', () => {
    expect(isShareableTemplate(templateById('github-trending'))).toBe(true);
    expect(isShareableTemplate(templateById('fx-pair'))).toBe(true);
    expect(isShareableTemplate(templateById('cisa-kev-recent'))).toBe(true);
  });

  it('never shares private-cloud sources', () => {
    // Owner-dependent results must never cross accounts.
    expect(isShareableTemplate(templateById('manual-metric'))).toBe(false);
    expect(isShareableTemplate(templateById('manual-cost'))).toBe(false);
    expect(isShareableTemplate(templateById('antenna-users'))).toBe(false);
    expect(isShareableTemplate(templateById('rest-metric'))).toBe(false);
    expect(isShareableTemplate(templateById('app-usage'))).toBe(false);
  });

  it('covers every registered template one way or the other', () => {
    for (const template of templates) {
      expect(typeof isShareableTemplate(template), template.id).toBe('boolean');
    }
  });
});

describe('snapshotCacheKey', () => {
  it('treats the same config as the same fetch regardless of key order', () => {
    expect(snapshotCacheKey('fx-pair', { base: 'EUR', quote: 'USD' })).toBe(
      snapshotCacheKey('fx-pair', { quote: 'USD', base: 'EUR' }),
    );
  });

  it('separates different configs and different templates', () => {
    expect(snapshotCacheKey('fx-pair', { base: 'EUR', quote: 'USD' })).not.toBe(
      snapshotCacheKey('fx-pair', { base: 'GBP', quote: 'USD' }),
    );
    expect(snapshotCacheKey('fx-pair', { base: 'EUR' })).not.toBe(
      snapshotCacheKey('crypto-history', { base: 'EUR' }),
    );
  });

  it('separates cached point projections after a connector schema change', () => {
    expect(snapshotCacheKey('tbench-leaderboard', {}, 1)).not.toBe(
      snapshotCacheKey('tbench-leaderboard', {}, 2),
    );
  });

  it('canonicalises nested objects and preserves array order', () => {
    expect(snapshotCacheKey('t', { a: { x: 1, y: 2 } })).toBe(
      snapshotCacheKey('t', { a: { y: 2, x: 1 } }),
    );
    expect(snapshotCacheKey('t', { a: [1, 2] })).not.toBe(snapshotCacheKey('t', { a: [2, 1] }));
  });
});

describe('maxSnapshotAgeMs', () => {
  it('allows at most half of the asking signal own refresh interval', () => {
    expect(maxSnapshotAgeMs({ refreshSeconds: 3600 } as SignalRow)).toBe(1_800_000);
    expect(maxSnapshotAgeMs({ refreshSeconds: 900 } as SignalRow)).toBe(450_000);
  });
});

describe('shared snapshot storage', () => {
  const key = snapshotCacheKey('fx-pair', { base: 'EUR', quote: 'USD' });

  it('serves a fresh snapshot back', async () => {
    await writeSharedSnapshot(client(), key, 'fx-pair', points, NOW);

    await expect(readSharedSnapshot(client(), key, 30 * MINUTE, NOW + MINUTE)).resolves.toEqual(
      points,
    );
  });

  it('misses once the snapshot is older than the caller allows', async () => {
    await writeSharedSnapshot(client(), key, 'fx-pair', points, NOW);

    await expect(
      readSharedSnapshot(client(), key, 30 * MINUTE, NOW + 31 * MINUTE),
    ).resolves.toBeNull();
  });

  it('misses on an unknown key', async () => {
    await expect(readSharedSnapshot(client(), 'nope', 30 * MINUTE, NOW)).resolves.toBeNull();
  });

  it('overwrites rather than accumulating rows per refresh', async () => {
    await writeSharedSnapshot(client(), key, 'fx-pair', points, NOW);
    const newer = [{ dimensions: { metric: 'x' }, value: 2, ts: NOW + MINUTE }];
    await writeSharedSnapshot(client(), key, 'fx-pair', newer, NOW + MINUTE);

    expect(db.select().from(schema.upstreamSnapshots).all()).toHaveLength(1);
    await expect(readSharedSnapshot(client(), key, 30 * MINUTE, NOW + MINUTE)).resolves.toEqual(
      newer,
    );
  });

  it('treats unreadable stored points as a miss instead of passing them on', async () => {
    db.insert(schema.upstreamSnapshots)
      .values({
        cacheKey: key,
        templateId: 'fx-pair',
        points: 'not json',
        fetchedAt: new Date(NOW),
      })
      .run();

    await expect(readSharedSnapshot(client(), key, 30 * MINUTE, NOW)).resolves.toBeNull();
  });

  it('treats structurally invalid stored points as a miss', async () => {
    db.insert(schema.upstreamSnapshots)
      .values({
        cacheKey: key,
        templateId: 'fx-pair',
        points: JSON.stringify([{ dimensions: [], value: null, ts: 'today' }]),
        fetchedAt: new Date(NOW),
      })
      .run();

    await expect(readSharedSnapshot(client(), key, 30 * MINUTE, NOW)).resolves.toBeNull();
  });

  it('purges expired rows while retaining fresh snapshots', async () => {
    await writeSharedSnapshot(client(), key, 'fx-pair', points, NOW - 2 * 24 * 3_600_000);
    await writeSharedSnapshot(client(), 'live-key', 'fx-pair', points, NOW);

    await purgeExpiredSnapshots(client(), NOW);

    expect(
      db
        .select()
        .from(schema.upstreamSnapshots)
        .all()
        .map((row) => row.cacheKey),
    ).toEqual(['live-key']);
  });
});
