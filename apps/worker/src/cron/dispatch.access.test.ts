// Access gates must refuse before an adapter runs.

import { eq } from 'drizzle-orm';
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
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runDispatch access gates', () => {
  let env: DispatchEnv;
  let db: Drizzle;

  const setCollectionVisibility = (visibility: 'shared' | 'public'): void => {
    db.update(schema.collections)
      .set({ visibility })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
  };

  beforeEach(() => {
    ({ db, env } = arrangeDispatch());
  });

  it('fails closed for review-required sources before fetching', async () => {
    seedSignal(
      db,
      'b1',
      'rest-metric',
      {
        url: 'https://example.test/private.json',
        jsonPath: '$.value',
      },
      900,
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    expect(fetchSpy).not.toHaveBeenCalled();
    const status = statusFor(db, 'b1');
    expect(status?.status).toBe('error');
    expect(status?.lastError).toContain('setup_required');
    expect(status?.lastError).toContain('Generic REST requires source review');
  });

  it('fails closed for public signals whose source policy is not public-display eligible', async () => {
    setCollectionVisibility('public');
    seedSignal(db, 'hist', 'market-history', { symbol: 'BA.L' }, 21_600, 0, 'public');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    expect(fetchSpy).not.toHaveBeenCalled();
    const status = statusFor(db, 'hist');
    expect(status?.status).toBe('error');
    expect(status?.lastError).toContain('cannot refresh externally visible signal');
    expect(status?.lastError).toContain('source_not_public_display_eligible');
  });

  it('fails closed for shared-link signals whose source is not public-display eligible', async () => {
    setCollectionVisibility('shared');
    seedSignal(db, 'hist', 'market-history', { symbol: 'BA.L' }, 21_600, 0, 'shared');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          chart: {
            result: [
              {
                meta: { symbol: 'BA.L', currency: 'GBp' },
                timestamp: [1_700_000_000],
                indicators: { quote: [{ close: [100.1] }] },
              },
            ],
            error: null,
          },
        }),
      ),
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    expect(pointsFor(db, 'hist')).toEqual([]);
    const status = statusFor(db, 'hist');
    expect(status?.status).toBe('error');
    expect(status?.lastError).toContain('source_not_public_display_eligible');
  });

  it('allows externally visible signals whose source policy permits public cloud display', async () => {
    setCollectionVisibility('public');
    seedSignal(db, 'fx', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0, 'public');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        ),
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
  });

  // Gate the D1-backed deployment signal during dispatch.
  describe('antenna-users', () => {
    const seedUser = (email: string): void => {
      db.insert(schema.user)
        .values({
          id: 'owner-1',
          name: 'owner-1',
          email,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    };

    it('materialises deployment counts for an admin-owned collection', async () => {
      seedUser('owner@example.test');
      seedSignal(db, 'users', 'antenna-users', {}, 3_600);
      env = { ...env, ADMIN_EMAILS: 'owner@example.test' };

      expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

      const points = pointsFor(db, 'users');
      expect(points.find((point) => point.metricKey.includes('metric=total_users'))?.value).toBe(1);
      // Aggregates only — an email must never reach a stored point.
      expect(JSON.stringify(points)).not.toContain('owner@example.test');
    });

    it('refuses to materialise counts for a non-admin owner', async () => {
      seedUser('someone@example.test');
      seedSignal(db, 'users', 'antenna-users', {}, 3_600);
      env = { ...env, ADMIN_EMAILS: 'owner@example.test' };

      expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });
      expect(pointsFor(db, 'users')).toHaveLength(0);
      expect(statusFor(db, 'users')?.lastError).toMatch(/deployment admins only/i);
    });

    it('refuses when no admin list is configured at all', async () => {
      seedUser('owner@example.test');
      seedSignal(db, 'users', 'antenna-users', {}, 3_600);

      expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });
      expect(statusFor(db, 'users')?.lastError).toMatch(/deployment admins only/i);
    });
  });
});
