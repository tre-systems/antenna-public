// How a failing signal is recorded, isolated from its siblings, and reported.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runDispatch, type DispatchEnv } from './dispatch';
import {
  arrangeDispatch,
  jsonResponse,
  makeChannels,
  seedSignal,
  seedStatus,
  statusFor,
  type Drizzle,
  type R2Stub,
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFailure = () =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));

describe('runDispatch failures', () => {
  let env: DispatchEnv;
  let r2: R2Stub;
  let db: Drizzle;

  beforeEach(() => {
    ({ db, env, r2 } = arrangeDispatch());
  });

  it('keeps an empty manual cost in an actionable setup state', async () => {
    seedSignal(
      db,
      'cost-cloudflare',
      'manual-cost',
      {
        amount: '',
        currency: 'GBP',
        period: 'month_to_date',
        provider: 'Cloudflare',
        service: 'All services',
      },
      86_400,
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = statusFor(db, 'cost-cloudflare');
    expect(status?.status).toBe('error');
    expect(status?.lastError).toBe('setup_required: Enter the current amount in card settings.');
    expect(db.select().from(schema.signalPoints).all()).toHaveLength(0);
  });

  it('marks a signal stale without touching last_ok_at on recoverable adapter failure', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    const originalOk = Date.now() - 60 * 60_000;
    seedStatus(db, 'b1', { lastOkAt: originalOk, updatedAt: originalOk });
    stubFailure();
    const channels = makeChannels();
    env = { ...env, CHANNELS: channels.namespace };

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = statusFor(db, 'b1');
    expect(status?.status).toBe('stale');
    expect(status?.lastError).toContain('fetch_failed');
    expect(status?.lastOkAt?.getTime()).toBe(originalOk);
    expect(r2.puts).toHaveLength(0);
    expect(status?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now());
    const body = channels.calls[0]?.body;
    if (typeof body !== 'string') throw new Error('expected notification body to be JSON');
    expect(body).toContain('"type":"signal_error"');
  });

  it('records an error on adapter failure when there is no previous success', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    stubFailure();

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = statusFor(db, 'b1');
    expect(status?.status).toBe('error');
    expect(status?.lastError).toContain('fetch_failed');
    expect(status?.lastOkAt).toBeNull();
  });

  it('records an error and skips fetch when stored config fails registry validation', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EU', quote: 'USD' }, 900);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
    const status = statusFor(db, 'b1');
    expect(status?.status).toBe('error');
    expect(status?.lastError).toContain('invalid_config: fx-pair');
  });

  it('marks unknown template as error without throwing', async () => {
    seedSignal(db, 'b1', 'not-a-template', {}, 900);
    vi.stubGlobal('fetch', vi.fn());

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });
    expect(statusFor(db, 'b1')?.lastError).toContain('unknown template');
  });

  it('isolates failures across sibling signals', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    seedSignal(db, 'b2', 'fx-pair', { base: 'GBP', quote: 'USD' }, 900, 1);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          url.includes('from=EUR')
            ? Promise.resolve(
                jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
              )
            : Promise.resolve(new Response('boom', { status: 500 })),
        ),
    );

    expect(await runDispatch(env)).toEqual({ ran: 2, ok: 1, failed: 1 });
    expect(statusFor(db, 'b1')?.status).toBe('live');
    expect(statusFor(db, 'b2')?.status).toBe('error');
  });

  it('logs per and per-tick results with one correlation id', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    seedSignal(db, 'b2', 'not-a-template', {}, 900, 1);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        ),
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDispatch(env);

    const entries = log.mock.calls.map(([line]) => {
      if (typeof line !== 'string') throw new Error('expected structured log line');
      return JSON.parse(line) as {
        event: string;
        run_id: string;
        signal_id?: string;
        status?: string;
        ok?: number;
        failed?: number;
      };
    });
    expect(new Set(entries.map((entry) => entry.run_id)).size).toBe(1);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'signal_dispatch_completed',
          signal_id: 'b1',
          status: 'live',
        }),
        expect.objectContaining({
          event: 'signal_dispatch_completed',
          signal_id: 'b2',
          status: 'error',
        }),
        expect.objectContaining({ event: 'dispatch_tick_completed', ok: 1, failed: 1 }),
      ]),
    );
  });
});
