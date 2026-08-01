import * as Sentry from '@sentry/cloudflare';
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { Hono } from 'hono';
import { routePath } from 'hono/route';
import { createAuth } from './auth';
import { refreshTokenBeingRotated, retireRotatedOAuthGrant } from './auth/oauth-rotation';
import { requireUser, type AuthVars } from './auth/middleware';
import type { WorkerEnv } from './env';
import { alertsRoute } from './routes/alerts';
import { signalsRoute } from './routes/signals';
import { authHealthRoute } from './routes/auth-health';
import { beaconRoute } from './routes/beacon';
import { collectionRoute } from './routes/collection';
import { collectionsRoute } from './routes/collections';
import { meRoute } from './routes/me';
import { createMcpRoute } from './routes/mcp';
import { mcpConnectionsRoute } from './routes/mcp-connections';
import { mcpTokensRoute } from './routes/mcp-tokens';
import { planRoute } from './routes/plan';
import { publicCollectionPageRoute } from './routes/public-collection-page';
import { publicCollectionsRoute } from './routes/public-collections';
import { reportRequestException } from './request-exception-telemetry';
import {
  createAuthOAuthCallbackRateLimit,
  createAuthOAuthStartRateLimit,
  createBeaconIngestRateLimit,
  createMcpRegisterRateLimit,
  createPlanCreateRateLimit,
  createPublicReadRateLimit,
} from './routes/public-read-rate-limit';
import { requestsRoute } from './routes/requests';
import { runScheduledTickWithTelemetry } from './scheduled';
import { sharedCollectionsRoute } from './routes/shared-collections';
import { streamRoute } from './routes/stream';
import { sentryOptions } from './sentry';
import { securityHeaders } from './security-headers';
import { templatesRoute } from './routes/templates';
import { reportWorkerInvocationException } from './invocation-exception-telemetry';
import { recordAntennaUsage } from './antenna-usage';

export { CollectionChannel } from './do/collection-channel';
export { RateLimiter } from './do/rate-limiter';

const app = new Hono<{ Bindings: WorkerEnv; Variables: AuthVars }>();

app.use('*', securityHeaders());
app.onError((error, c) => {
  reportRequestException(error, {
    method: c.req.method,
    path: c.req.path,
    routePath: routePath(c, -1),
  });
  return c.text('Internal Server Error', 500);
});

app.get('/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

// Inject public share metadata before the SPA takes over.
app.route('/c', publicCollectionPageRoute);

// Better Auth needs the raw request to read cookies and OAuth state.
const isAuthOAuthStartRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean => /^\/api\/auth\/sign-in(?:\/|$)/.test(c.req.path);

const isAuthOAuthCallbackRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean => /^\/api\/auth\/callback(?:\/|$)/.test(c.req.path);

// Cap anonymous MCP client registration by requester IP.
const isMcpRegisterRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean => c.req.method === 'POST' && /^\/api\/auth\/mcp\/register(?:\/|$)/.test(c.req.path);

app.use('/api/auth/*', createAuthOAuthStartRateLimit({ shouldLimit: isAuthOAuthStartRequest }));
app.use(
  '/api/auth/*',
  createAuthOAuthCallbackRateLimit({ shouldLimit: isAuthOAuthCallbackRequest }),
);
app.use('/api/auth/*', createMcpRegisterRateLimit({ shouldLimit: isMcpRegisterRequest }));
app.all('/api/auth/*', async (c) => {
  const rotatingRefreshToken = /^\/api\/auth\/mcp\/token(?:\/|$)/.test(c.req.path)
    ? await refreshTokenBeingRotated(c.req.raw.clone())
    : null;
  const response = await createAuth(c.env).handler(c.req.raw);
  if (response.ok && rotatingRefreshToken !== null) {
    // Remove the consumed grant only after its replacement succeeds.
    await retireRotatedOAuthGrant(c.env, rotatingRefreshToken);
  }
  return response;
});

// Mirror Better Auth metadata at the root paths MCP clients probe.
app.get('/.well-known/oauth-authorization-server', (c) =>
  oAuthDiscoveryMetadata(createAuth(c.env))(c.req.raw),
);
app.get('/.well-known/oauth-protected-resource', (c) =>
  oAuthProtectedResourceMetadata(createAuth(c.env))(c.req.raw),
);
app.get('/.well-known/oauth-protected-resource/api/mcp', (c) =>
  oAuthProtectedResourceMetadata(createAuth(c.env))(c.req.raw),
);

// External reads precede session auth but still enforce visibility and source policy.
const publicReadRateLimit = createPublicReadRateLimit();
app.use('/api/public/*', publicReadRateLimit);
app.use('/api/shared/*', publicReadRateLimit);
app.route('/api/public/collections', publicCollectionsRoute);
app.route('/api/shared/collections', sharedCollectionsRoute);

// Usage ingest uses a machine token, so it precedes session auth.
app.use('/api/beacon', createBeaconIngestRateLimit());
app.route('/api/beacon', beaconRoute);

// Everything else under /api/* requires a session.
app.use('/api/*', requireUser());
app.use('/api/*', recordAntennaUsage());

const isPlanCreateRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean => c.req.method === 'POST' && c.req.path === '/api/plan';

app.route('/api/signals', signalsRoute);
app.route('/api/healthz', authHealthRoute);
app.route('/api/alerts', alertsRoute);
app.route('/api/collection', collectionRoute);
app.route('/api/collections', collectionsRoute);
app.route('/api/collections', streamRoute);
app.route('/api/me', meRoute);
// Dispatch MCP self-proxy calls in-process to avoid Cloudflare hostname loops.
app.route(
  '/api/mcp',
  createMcpRoute({ dispatch: async (req, env, ctx) => app.fetch(req, env as WorkerEnv, ctx) }),
);
app.route('/api/mcp-tokens', mcpTokensRoute);
app.route('/api/mcp-connections', mcpConnectionsRoute);
app.use('/api/plan', createPlanCreateRateLimit({ shouldLimit: isPlanCreateRequest }));
app.route('/api/plan', planRoute);
app.route('/api/requests', requestsRoute);
app.route('/api/templates', templatesRoute);

const shouldServeSpaAsset = (pathname: string): boolean =>
  !(
    pathname === '/healthz' ||
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/.well-known/')
  );

app.get('*', (c) => {
  const { pathname } = new URL(c.req.url);
  if (!shouldServeSpaAsset(pathname)) return c.text('Not Found', 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

const handler = {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      return await app.fetch(request, env, ctx);
    } catch (error: unknown) {
      const { pathname } = new URL(request.url);
      reportWorkerInvocationException(error, {
        method: request.method,
        path: pathname,
        surface: 'fetch',
      });
      return new Response('Internal Server Error', { status: 500 });
    }
  },
  scheduled(_event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runScheduledTickWithTelemetry(env).catch((error: unknown) => {
        reportWorkerInvocationException(error, {
          method: 'SCHEDULED',
          path: '/cron',
          routePath: 'Scheduled cron tick',
          surface: 'scheduled',
        });
      }),
    );
  },
} satisfies ExportedHandler<WorkerEnv>;

export default Sentry.withSentry(sentryOptions, handler);
