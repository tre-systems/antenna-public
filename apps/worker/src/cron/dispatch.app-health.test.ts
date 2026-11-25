import { afterEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { parseStringRecord } from '../db/codecs';
import { runDispatch } from './dispatch';
import {
  arrangeDispatch,
  pointsFor,
  seedSignal,
  seedStatus,
  statusFor,
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const arrangeHealth = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  const { db, env } = arrangeDispatch();
  db.insert(schema.user)
    .values({
      id: 'owner-1',
      name: 'Admin',
      email: 'admin@example.test',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  seedSignal(db, 'health', 'app-health', { projects: 'first,second' }, 900);
  return {
    db,
    env: {
      ...env,
      ADMIN_EMAILS: 'admin@example.test',
      APP_HEALTH_MANIFEST: JSON.stringify({
        first: 'https://first.test/health',
        second: 'https://second.test/health',
      }),
    },
  };
};

describe('app-health observation freshness', () => {
  it('persists genuine downtime alongside a failed probe without advancing last success', async () => {
    const { db, env } = arrangeHealth();
    const lastOk = Date.now() - 3600_000;
    seedStatus(db, 'health', { lastOkAt: lastOk, updatedAt: lastOk });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockRejectedValueOnce(new TypeError('private details')),
    );
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });
    const status = statusFor(db, 'health');
    expect(status).toMatchObject({ status: 'stale', lastOkAt: new Date(lastOk) });
    expect(status?.lastError).toContain('1 health probes unavailable');
    const points = pointsFor(db, 'health');
    expect(points).toHaveLength(2);
    const down = points.find((point) => point.value === 0);
    const unknown = points.find((point) => point.valueText === 'unknown');
    expect(parseStringRecord(down?.dimensions)).toMatchObject({
      state: 'down',
      http_status: '503',
    });
    expect(parseStringRecord(unknown?.dimensions)).toMatchObject({
      state: 'probe_error',
      http_status: '0',
    });
    expect(unknown?.value).toBeNull();
    expect(status?.lastDataAt?.getTime()).toBe(Date.now());
    expect(JSON.stringify(status)).not.toContain('private details');
  });

  it('does not claim a successful observation when every probe fails, and recovers on real responses', async () => {
    const { db, env } = arrangeHealth();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')));
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });
    expect(statusFor(db, 'health')).toMatchObject({ status: 'error', lastOkAt: null });
    expect(pointsFor(db, 'health')).toHaveLength(2);
    vi.setSystemTime(Date.now() + 901_000);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('ok'))),
    );
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(statusFor(db, 'health')).toMatchObject({
      status: 'live',
      lastOkAt: new Date(),
      lastError: null,
    });
  });

  it('records HTTP failures as fresh observations and deduplicates unchanged successful checks', async () => {
    const { db, env } = arrangeHealth();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    const first = statusFor(db, 'health');
    expect(first).toMatchObject({ status: 'live', lastOkAt: new Date(), lastError: null });
    vi.setSystemTime(Date.now() + 901_000);
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(statusFor(db, 'health')).toMatchObject({
      lastOkAt: new Date(),
      lastDataAt: first?.lastDataAt,
    });
    expect(pointsFor(db, 'health')).toHaveLength(2);
    expect(pointsFor(db, 'health').every((point) => point.value === 0)).toBe(true);
  });
});
