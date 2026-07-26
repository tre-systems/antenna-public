import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAlerts,
  getNotificationPreferences,
  updateNotificationPreference,
} from './notifications';
import { captureFetch } from './test-support';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api notification endpoints', () => {
  it('getAlerts GETs recent alerts with optional filters', async () => {
    const calls = captureFetch({ alerts: [] });
    const result = await getAlerts({ collection_id: 'collection/1', since: 1000, limit: 20 });
    expect(result).toEqual({ alerts: [] });
    expect(calls[0]?.url).toBe('/api/alerts?collection_id=collection%2F1&since=1000&limit=20');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getNotificationPreferences GETs global or collection scoped preferences', async () => {
    const calls = captureFetch({ preferences: [] });
    await getNotificationPreferences('collection/1');
    expect(calls[0]?.url).toBe('/api/notifications/preferences?collection_id=collection%2F1');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('updateNotificationPreference PATCHes a channel preference', async () => {
    const body = {
      preference: {
        collection_id: null,
        channel: 'daily_digest',
        enabled: true,
        frequency: 'daily',
        quiet_hours_start: null,
        quiet_hours_end: null,
        updated_at: 10,
      },
    };
    const calls = captureFetch(body);
    const result = await updateNotificationPreference('daily_digest', {
      enabled: true,
      frequency: 'weekly',
    });
    expect(result).toEqual(body);
    expect(calls[0]?.url).toBe('/api/notifications/preferences/daily_digest');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ enabled: true, frequency: 'weekly' }));
  });
});
