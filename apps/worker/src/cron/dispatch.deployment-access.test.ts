import { afterEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runDispatch } from './dispatch';
import { arrangeDispatch, seedSignal, pointsFor, statusFor } from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());
afterEach(() => vi.unstubAllGlobals());

const privateTemplates = [
  'cloudflare-analytics',
  'cloudflare-web-analytics',
  'app-usage',
  'project-portfolio',
  'app-health',
];

describe('deployment credential isolation', () => {
  it.each(privateTemplates)(
    'denies %s to an ordinary owner before fetching',
    async (templateId) => {
      const { db, env } = arrangeDispatch();
      seedSignal(
        db,
        'private-source',
        templateId,
        { account_id: 'a'.repeat(32), project: 'example', projects: 'example' },
        3600,
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const result = await runDispatch({
        ...env,
        CF_ANALYTICS_API_TOKEN: 'server-secret',
        APP_HEALTH_MANIFEST: '{"example":"https://example.test/health"}',
      });
      expect(result).toEqual({ ran: 1, ok: 0, failed: 1 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(pointsFor(db, 'private-source')).toEqual([]);
      expect(statusFor(db, 'private-source')?.lastError).toContain('deployment admins only');
    },
  );

  it('allows a deployment administrator to probe the server-owned manifest', async () => {
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
    seedSignal(db, 'health', 'app-health', { projects: 'example' }, 3600);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')));
    expect(
      await runDispatch({
        ...env,
        ADMIN_EMAILS: 'admin@example.test',
        APP_HEALTH_MANIFEST: '{"example":"https://example.test/health"}',
      }),
    ).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(pointsFor(db, 'health')).toHaveLength(1);
  });
});
