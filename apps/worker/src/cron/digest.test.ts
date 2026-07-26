import { afterEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runDailyDigests } from './digest';
import {
  DIGEST_WINDOW_MS,
  seedDigestCandidate,
  seedPref,
  setup,
  type Drizzle,
  type PrefOptions,
} from './digest-test-fixtures';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

const arrange = (pref?: PrefOptions) => {
  const { db, env } = setup();
  seedDigestCandidate(db, pref);
  return { db, env };
};

const stubFetch = (response?: Response) => {
  const fetchMock = response
    ? vi.fn().mockResolvedValue(response)
    : vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const resendRequest = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  if (typeof init.body !== 'string') throw new Error('expected Resend request body to be JSON');
  return JSON.parse(init.body) as {
    readonly to: readonly string[];
    readonly subject: string;
    readonly text: string;
  };
};

const deliveries = (db: Drizzle) => db.select().from(schema.notificationDeliveries).all();

describe('runDailyDigests', () => {
  it('sends one digest per collection with recent alerts and records delivery', async () => {
    const { db, env } = arrange();
    const fetchMock = stubFetch();

    const summary = await runDailyDigests(env, DIGEST_WINDOW_MS);
    const second = await runDailyDigests(env, DIGEST_WINDOW_MS);

    expect(summary).toEqual({ considered: 1, sent: 1, skipped: 0, failed: 0 });
    expect(second).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = resendRequest(fetchMock);
    expect(request.to).toEqual(['user@example.test']);
    expect(request.subject).toBe('Antenna daily brief: Morning Collection');
    expect(request.text).toContain('EUR/USD');
    expect(request.text).toContain('Antenna daily brief for Morning Collection');
    expect(request.text).toContain('Open Antenna: https://antenna.test');
    expect(deliveries(db)).toMatchObject([
      {
        id: 'user-1:collection-1:daily_digest:2026-05-25',
        userId: 'user-1',
        collectionId: 'collection-1',
        sentAt: new Date(DIGEST_WINDOW_MS),
        status: 'sent',
        error: null,
      },
    ]);
  });

  it('skips sending outside the digest window', async () => {
    const { env } = arrange();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, Date.parse('2026-05-25T08:00:00Z'));

    expect(summary).toEqual({ considered: 0, sent: 0, skipped: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send weekly preferences on non-weekly brief days', async () => {
    const { env } = arrange({ frequency: 'weekly' });
    const fetchMock = stubFetch();

    const summary = await runDailyDigests(env, Date.parse('2026-05-26T06:05:00Z'));

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends weekly preferences on the weekly brief day with weekly copy', async () => {
    const { db, env } = arrange({ frequency: 'weekly' });
    const fetchMock = stubFetch();

    const summary = await runDailyDigests(env, DIGEST_WINDOW_MS);

    expect(summary).toEqual({ considered: 1, sent: 1, skipped: 0, failed: 0 });
    const request = resendRequest(fetchMock);
    expect(request.subject).toBe('Antenna weekly brief: Morning Collection');
    expect(request.text).toContain('Antenna weekly brief for Morning Collection');
    expect(deliveries(db)).toMatchObject([
      {
        id: 'user-1:collection-1:daily_digest:weekly:2026-05-25',
        periodStart: new Date(DIGEST_WINDOW_MS - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(DIGEST_WINDOW_MS),
        sentAt: new Date(DIGEST_WINDOW_MS),
        status: 'sent',
      },
    ]);
  });

  it('does not record a delivery when Resend is not configured', async () => {
    const { db, env } = arrange();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests({ ...env, RESEND_API_KEY: undefined }, DIGEST_WINDOW_MS);

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(deliveries(db)).toEqual([]);
  });

  it('records a failed delivery when Resend cannot be reached', async () => {
    const { db, env } = arrange();
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, DIGEST_WINDOW_MS);

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 0, failed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deliveries(db)).toMatchObject([
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
    const { db, env } = arrange();
    seedPref(db, {
      scope: 'collection:collection-1',
      collectionId: 'collection-1',
      quietHoursStart: '06:00',
      quietHoursEnd: '08:00',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDailyDigests(env, DIGEST_WINDOW_MS);

    expect(summary).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
