import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectPortfolio } from './project-portfolio';

const ACCOUNT_ID = 'a'.repeat(32);
const config = {
  projects: 'antenna,sample-service,quiet-app',
  accountId: ACCOUNT_ID,
  apiToken: 'token',
  days: 7,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('projectPortfolio', () => {
  it('compares configured projects across recent and preceding windows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { project: 'antenna', day: '2026-07-16 00:00:00', event: 'view', count: 10 },
            { project: 'antenna', day: '2026-07-15 00:00:00', event: 'mcp_call', count: 4 },
            { project: 'antenna', day: '2026-07-06 00:00:00', event: 'view', count: 7 },
            {
              project: 'sample-service',
              day: '2026-07-14 00:00:00',
              event: 'game_started',
              count: 3,
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await projectPortfolio(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toMatchObject({
      dimensions: {
        project: 'antenna',
        previous: 7,
        top_event: 'view',
        metric: 'project_activity',
      },
      value: 14,
      unit: 'events',
    });
    expect(result.points[2]).toMatchObject({
      dimensions: { project: 'quiet-app', previous: 0 },
      value: 0,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(init.body).toContain("INTERVAL '14' DAY");
    expect(init.body).toContain('index1 AS project');
  });

  it('rejects unsafe project lists before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await projectPortfolio({ ...config, projects: "ok,bad';DROP" });
    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid project list' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
