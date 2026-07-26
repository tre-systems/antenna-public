// What a successful tick persists: points, status, alert rows, raw payloads.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runDispatch, type DispatchEnv } from './dispatch';
import {
  arrangeDispatch,
  jsonResponse,
  pointsFor,
  seedSignal,
  statusFor,
  type Drizzle,
  type R2Stub,
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

const fxResponse = (rate: number) =>
  jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: rate } });

describe('runDispatch point writes', () => {
  let env: DispatchEnv;
  let r2: R2Stub;
  let db: Drizzle;

  beforeEach(() => {
    ({ db, env, r2 } = arrangeDispatch());
  });

  it('runs a never-fetched signal and writes point/status without default R2 archival', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fxResponse(1.08)));

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });

    const points = pointsFor(db, 'b1');
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(1.08);
    expect(points[0]?.fetchedAt.getTime()).toBeGreaterThan(Date.parse('2026-05-19'));
    expect(points[0]?.observedAt.getTime()).toBe(Date.parse('2026-05-19'));
    expect(points[0]?.rawPayloadId).toBeNull();

    const status = statusFor(db, 'b1');
    expect(status?.status).toBe('live');
    expect(status?.lastOkAt).not.toBeNull();
    expect(status?.lastError).toBeNull();

    expect(r2.puts).toHaveLength(0);
  });

  it('updates an existing point when a provider revises the same timestamp', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 0);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(fxResponse(1.08)).mockResolvedValueOnce(fxResponse(1.09)),
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

    const points = pointsFor(db, 'b1');
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(1.09);
  });

  it('records registry alert rules when a new point breaches a threshold', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 0);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(Date.parse('2026-05-18T12:00:00Z')),
        observedAt: new Date(Date.parse('2026-05-18T00:00:00Z')),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.08,
        unit: 'USD',
        sourceUrl: 'https://www.frankfurter.app/',
      })
      .run();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(fxResponse(1.09))),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    const alerts = db.select().from(schema.signalAlerts).all();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      collectionId: 'collection-1',
      signalId: 'b1',
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'pair=EUR/USD',
      value: 1.09,
      previousValue: 1.08,
      unit: 'USD',
      sourceUrl: 'https://www.frankfurter.app/',
    });

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(db.select().from(schema.signalAlerts).all()).toHaveLength(1);
  });

  it('stores large yearly history payloads in D1-safe batches', async () => {
    seedSignal(db, 'hist', 'market-history', { symbol: 'BA.L' }, 21_600);
    const timestamps = Array.from({ length: 4_000 }, (_, index) => 1_700_000_000 + index * 86_400);
    const close = timestamps.map((_, index) => 100 + index / 100);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          chart: {
            result: [
              {
                meta: { symbol: 'BA.L', currency: 'GBp' },
                timestamp: timestamps,
                indicators: { quote: [{ close }] },
              },
            ],
            error: null,
          },
        }),
      ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(pointsFor(db, 'hist')).toHaveLength(4_000);
    expect(statusFor(db, 'hist')?.status).toBe('live');
    expect(statusFor(db, 'hist')?.lastError).toBeNull();
  });

  it('materialises owner-provided manual metrics without a network request', async () => {
    seedSignal(db, 'manual', 'manual-metric', { value: 42, unit: 'items' }, 86_400);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const points = pointsFor(db, 'manual');
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ value: 42, unit: 'items' });
    expect(statusFor(db, 'manual')?.status).toBe('live');
    expect(statusFor(db, 'manual')?.lastError).toBeNull();
  });

  it('does not write R2 payloads for default registry templates', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    seedSignal(db, 'b2', 'fx-pair', { base: 'GBP', quote: 'USD' }, 900, 1);
    const put = vi.fn(() => Promise.reject(new Error('R2 should not be called')));
    env = { ...env, PAYLOADS: { put } as unknown as R2Bucket };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const base = url.includes('from=EUR') ? 'EUR' : 'GBP';
        return Promise.resolve(
          jsonResponse({
            amount: 1,
            base,
            date: '2026-05-19',
            rates: { USD: base === 'EUR' ? 1.08 : 1.25 },
          }),
        );
      }),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 2, ok: 2, failed: 0 });
    const points = db.select().from(schema.signalPoints).all();
    expect(points).toHaveLength(2);
    expect(points.every((point) => point.rawPayloadId === null)).toBe(true);
    expect(statusFor(db, 'b1')?.status).toBe('live');
    expect(statusFor(db, 'b2')?.status).toBe('live');
    expect(put).not.toHaveBeenCalled();
  });
});
