import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createAntennaMcpServer } from '@antenna/mcp/factory';
import type { FetchLike } from '@antenna/mcp';
import { Hono } from 'hono';
import type { AuthVars, MiddlewareEnv } from '../auth/middleware';
import { authenticateOAuthToken, extractBearerToken, TOKEN_PREFIX } from '../auth/mcp-token';
import { db } from '../db/client';
import { err } from './http';

type Bindings = MiddlewareEnv;

type McpRouteOptions = {
  readonly fetchImpl?: FetchLike;
  // In-process dispatch back into the Worker's own Hono app. /api/mcp self-proxies
  // to /api/*, and doing that over the network (a fetch to our own hostname) fails
  // on Cloudflare with a 522 self-loop, so when a dispatcher is provided we route
  // those calls in-process (a direct function call) instead.
  readonly dispatch?: (request: Request, env: Bindings, ctx: ExecutionContext) => Promise<Response>;
};

export function createMcpRoute(options: McpRouteOptions = {}) {
  const route = new Hono<{ Bindings: Bindings; Variables: AuthVars }>();

  route.all('/', async (c) => {
    const bearerToken = extractBearerToken(c.req.raw.headers.get('authorization'));
    const sessionCookie = nonEmptyHeader(c.req.raw.headers.get('cookie'));

    // A `pbk_` token or a browser session passes straight through — the
    // self-proxied /api/* calls re-validate it. Any other bearer is an OAuth
    // access token: validate it here (with expiry) so a missing or invalid
    // credential is answered with the discovery challenge. MCP clients rely on
    // the 401 + WWW-Authenticate header to bootstrap the OAuth flow.
    const isLegacyBearer = bearerToken !== null && bearerToken.startsWith(TOKEN_PREFIX);
    if (!isLegacyBearer && sessionCookie === undefined) {
      const oauthUser =
        bearerToken === null ? null : await authenticateOAuthToken(db(c.env), bearerToken);
      if (oauthUser === null) {
        const resourceMetadata = `${new URL(c.req.url).origin}/.well-known/oauth-protected-resource`;
        c.header('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}"`);
        return err(c, 'unauthorized', 401);
      }
    }

    // Stateless MCP handles requests synchronously over POST. Letting the SDK
    // open a standalone GET SSE stream leaves Cloudflare with an idle response
    // that is eventually cancelled as a hung Worker request.
    if (c.req.method === 'GET') {
      c.header('Allow', 'POST');
      c.header('Cache-Control', 'no-store');
      return err(c, 'mcp_get_stream_unsupported', 405);
    }

    // Self-proxy transport: prefer the in-process dispatcher (avoids the 522
    // self-loop on Cloudflare); fall back to options.fetchImpl (used by tests).
    const dispatch = options.dispatch;
    const fetchImpl: FetchLike | undefined = dispatch
      ? (input, init) =>
          dispatch(new Request(input, init), c.env, c.executionCtx as unknown as ExecutionContext)
      : options.fetchImpl;

    const server = createAntennaMcpServer({
      baseUrl: new URL(c.req.url).origin,
      token: bearerToken ?? undefined,
      sessionCookie: bearerToken === null ? sessionCookie : undefined,
      fetchImpl,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return route;
}

export const mcpRoute = createMcpRoute();

function nonEmptyHeader(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
