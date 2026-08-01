import type { MiddlewareHandler } from 'hono';
import type { WorkerEnv } from './env';
import type { AuthVars } from './auth/middleware';

const eventFor = (method: string, path: string): string | null => {
  if (method === 'POST' && path === '/api/mcp') return 'mcp_request_completed';
  if (method === 'POST' && /^\/api\/plan\/[^/]+\/confirm$/.test(path)) return 'plan_confirmed';
  if (method === 'POST' && /^\/api\/signals\/[^/]+\/refresh$/.test(path)) {
    return 'signal_refresh_requested';
  }
  if (method === 'PATCH' && /^\/api\/signals\/[^/]+$/.test(path)) return 'signal_updated';
  if (method === 'DELETE' && /^\/api\/signals\/[^/]+$/.test(path)) return 'signal_removed';
  if (method === 'POST' && path === '/api/collections') return 'collection_created';
  return null;
};

export const recordAntennaUsage =
  (): MiddlewareHandler<{
    Bindings: WorkerEnv;
    Variables: AuthVars;
  }> =>
  async (c, next) => {
    await next();
    if (c.res.status >= 400) return;
    const event = eventFor(c.req.method, c.req.path);
    if (event === null) return;
    c.env.APP_USAGE?.writeDataPoint({
      indexes: ['antenna'],
      blobs: [event],
      doubles: [1],
    });
  };
