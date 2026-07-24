import * as Sentry from '@sentry/cloudflare';
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { Hono } from 'hono';
import { createAuth } from './auth';
import { cleanupExpiredOAuthState, shouldRunOAuthCleanup } from './auth/oauth-cleanup';
import { refreshTokenBeingRotated, retireRotatedOAuthGrant } from './auth/oauth-rotation';
import { requireUser, type AuthVars } from './auth/middleware';
import { runDailyDigests } from './cron/digest';
import { runDispatch } from './cron/dispatch';
import { runPointRetention, shouldRunPointRetention } from './cron/point-retention';
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
import { notificationsRoute } from './routes/notifications';
import { planRoute } from './routes/plan';
import { publicCollectionPageRoute } from './routes/public-collection-page';
import { publicCollectionsRoute } from './routes/public-collections';
import {
  createAuthOAuthCallbackRateLimit,
  createAuthOAuthStartRateLimit,
  createBeaconIngestRateLimit,
  createMcpRegisterRateLimit,
  createPlanCreateRateLimit,
  createPublicReadRateLimit,
  createPublicReportRateLimit,
} from './routes/public-read-rate-limit';
import { requestsRoute } from './routes/requests';
import { sharedCollectionsRoute } from './routes/shared-collections';
import { streamRoute } from './routes/stream';
import { sentryOptions } from './sentry';
import { securityHeaders } from './security-headers';
import { templatesRoute } from './routes/templates';

export { CollectionChannel } from './do/collection-channel';
export { RateLimiter } from './do/rate-limiter';

const app = new Hono<{ Bindings: WorkerEnv; Variables: AuthVars }>();

app.use('*', securityHeaders());

app.get('/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

// Public collection pages need server-rendered share metadata for unfurlers.
// Static Assets still serves the SPA shell; this route only injects page-specific
// meta tags before the browser app takes over.
app.route('/c', publicCollectionPageRoute);

// BA mounts its own router under /api/auth/* (sign-in, callback, get-session,
// sign-out, etc.). Hand the raw Request straight through — BA expects the
// full Request object so it can read cookies and the OAuth state.
const isAuthOAuthStartRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean => /^\/api\/auth\/sign-in(?:\/|$)/.test(c.req.path);

const isAuthOAuthCallbackRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean => /^\/api\/auth\/callback(?:\/|$)/.test(c.req.path);

// Anonymous MCP dynamic client registration — cap per-IP so it can't be used to
// spam oauth_application rows. Legitimate clients register once per device.
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
    // Better Auth creates the replacement grant but does not retire the one it
    // consumed. Remove it only after success to enforce refresh-token rotation.
    await retireRotatedOAuthGrant(c.env, rotatingRefreshToken);
  }
  return response;
});

// OAuth discovery at the origin root (RFC 8414 / RFC 9728) so MCP clients that
// probe the well-known paths — or follow the WWW-Authenticate challenge from
// /api/mcp — find the authorization server. The metadata is produced by the
// Better Auth `mcp` plugin; these mirror it at the root path clients expect.
app.get('/.well-known/oauth-authorization-server', (c) =>
  oAuthDiscoveryMetadata(createAuth(c.env))(c.req.raw),
);
app.get('/.well-known/oauth-protected-resource', (c) =>
  oAuthProtectedResourceMetadata(createAuth(c.env))(c.req.raw),
);
app.get('/.well-known/oauth-protected-resource/api/mcp', (c) =>
  oAuthProtectedResourceMetadata(createAuth(c.env))(c.req.raw),
);

// External collection reads are deliberately mounted before the session
// middleware. These routes still fail closed unless collection visibility,
// signal visibility, and source policy allow the requested exposure.
const isPublicCollectionReportRequest = (c: {
  readonly req: { readonly method: string; readonly path: string };
}): boolean =>
  c.req.method === 'POST' && /^\/api\/public\/collections\/[^/]+\/report$/.test(c.req.path);

const publicReportRateLimit = createPublicReportRateLimit({
  shouldLimit: isPublicCollectionReportRequest,
});
const publicReadRateLimit = createPublicReadRateLimit({
  shouldLimit: (c) => !isPublicCollectionReportRequest(c),
});
app.use('/api/public/*', publicReportRateLimit);
app.use('/api/public/*', publicReadRateLimit);
app.use('/api/shared/*', publicReadRateLimit);
app.route('/api/public/collections', publicCollectionsRoute);
app.route('/api/shared/collections', sharedCollectionsRoute);

// Usage-event ingest authenticates with a machine token, not a session, so it
// mounts ahead of the session middleware like the public read routes.
app.use('/api/beacon', createBeaconIngestRateLimit());
app.route('/api/beacon', beaconRoute);

// Everything else under /api/* requires a session.
app.use('/api/*', requireUser());

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
// Dispatch the MCP server's self-proxied /api/* calls in-process (a Cloudflare
// Worker can't fetch its own hostname — it 522s), re-entering this same app.
app.route(
  '/api/mcp',
  createMcpRoute({ dispatch: async (req, env, ctx) => app.fetch(req, env as WorkerEnv, ctx) }),
);
app.route('/api/mcp-tokens', mcpTokensRoute);
app.route('/api/mcp-connections', mcpConnectionsRoute);
app.route('/api/notifications', notificationsRoute);
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

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export const runScheduledTick = async (env: WorkerEnv, now = Date.now()): Promise<void> => {
  try {
    const summary = await runDispatch(env);
    // Cron logs surface in `wrangler tail`; structured payload makes them filterable.
    console.log(JSON.stringify({ event: 'dispatch', ...summary }));
  } catch (err: unknown) {
    console.error(JSON.stringify({ event: 'dispatch_failed', error: errorMessage(err) }));
  }

  try {
    const digest = await runDailyDigests(env);
    console.log(JSON.stringify({ event: 'daily_digest', ...digest }));
  } catch (err: unknown) {
    console.error(JSON.stringify({ event: 'daily_digest_failed', error: errorMessage(err) }));
  }

  if (shouldRunOAuthCleanup(now)) {
    try {
      await cleanupExpiredOAuthState(env, now);
      console.log(JSON.stringify({ event: 'oauth_cleanup' }));
    } catch (err: unknown) {
      console.error(JSON.stringify({ event: 'oauth_cleanup_failed', error: errorMessage(err) }));
    }
  }

  if (shouldRunPointRetention(now)) {
    try {
      const retention = await runPointRetention(env, now);
      console.log(JSON.stringify({ event: 'point_retention', ...retention }));
    } catch (err: unknown) {
      console.error(JSON.stringify({ event: 'point_retention_failed', error: errorMessage(err) }));
    }
  }
};

const runScheduledTickWithTelemetry = (env: WorkerEnv): Promise<void> =>
  Sentry.startSpan(
    {
      name: 'Scheduled cron tick',
      op: 'faas.cron',
      forceTransaction: true,
      attributes: {
        'sentry.source': 'task',
      },
    },
    () => runScheduledTick(env),
  );

app.get('*', (c) => {
  const { pathname } = new URL(c.req.url);
  if (!shouldServeSpaAsset(pathname)) return c.text('Not Found', 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

const handler = {
  fetch: app.fetch,
  scheduled(_event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledTickWithTelemetry(env));
  },
} satisfies ExportedHandler<WorkerEnv>;

export default Sentry.withSentry(sentryOptions, handler);
