import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, seedBaseline, setup, type Drizzle } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/signals point selection', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    seedBaseline(db);
  });

  it('returns latest points for all owned signals in one listing', async () => {
    db.insert(schema.signals)
      .values({
        id: 'b-extra',
        collectionId: 'collection-1',
        templateId: 'fx-pair',
        title: 'GBP/USD',
        config: JSON.stringify({ base: 'GBP', quote: 'USD' }) as unknown as schema.SignalConfig,
        refreshSeconds: 900,
        position: 1,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: new Date(1_700_000_000_000),
          observedAt: new Date(1_700_000_000_000),
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
        {
          signalId: 'b-extra',
          fetchedAt: new Date(1_700_000_010_000),
          observedAt: new Date(1_700_000_010_000),
          metricKey: 'pair=GBP/USD',
          dimensions: JSON.stringify({ pair: 'GBP/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.25,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{ id: string; points: Array<{ value: number }> }> = await res.json();

    expect(body).toHaveLength(2);
    expect(body.map((signal) => [signal.id, signal.points[0]?.value])).toEqual([
      ['b1', 1.09],
      ['b-extra', 1.25],
    ]);
  });

  it('keeps per-signal latest points even when other signals dominate by fetched_at', async () => {
    // Regression: a flat `LIMIT POINT_LIMIT * signalCount` ordered globally by
    // fetched_at lets live signals (which write many fresh rows on every cron
    // tick) starve out history-heavy signals whose latest fetched_at is older
    // (their data is historical-dated). The per-signal top-N must survive.
    db.insert(schema.signals)
      .values({
        id: 'b-history',
        collectionId: 'collection-1',
        templateId: 'macro-market-history',
        title: 'UK 10Y gilt 1Y',
        config: JSON.stringify({ preset: 'uk-10y-gilt' }) as unknown as schema.SignalConfig,
        refreshSeconds: 21_600,
        position: 1,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    // The live signal (b1) has 80 very-recent points; the history signal
    // (b-history) has one older point. Old flat-limit logic would consume the
    // global budget on b1 and return [] for b-history.
    const liveBase = Date.now() - 60_000;
    for (let i = 0; i < 80; i += 1) {
      db.insert(schema.signalPoints)
        .values({
          signalId: 'b1',
          fetchedAt: new Date(liveBase + i),
          observedAt: new Date(liveBase + i),
          metricKey: `m${String(i)}`,
          dimensions: JSON.stringify({}) as unknown as schema.DataPointDimensions,
          value: i,
          unit: 'USD',
        })
        .run();
    }
    const historyTs = new Date(Date.now() - 5 * 86_400_000);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b-history',
        fetchedAt: historyTs,
        observedAt: historyTs,
        metricKey: 'yield',
        dimensions: JSON.stringify({}) as unknown as schema.DataPointDimensions,
        value: 5.1,
        unit: '%',
      })
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{ id: string; points: Array<{ value: number }> }> = await res.json();
    const history = body.find((b) => b.id === 'b-history');
    expect(history?.points).toHaveLength(1);
    expect(history?.points[0]?.value).toBe(5.1);
  });
});
