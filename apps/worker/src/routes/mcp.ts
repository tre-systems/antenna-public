import {
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';
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
  // Dispatch self-proxy calls in-process to avoid Cloudflare hostname loops.
  readonly dispatch?: (request: Request, env: Bindings, ctx: ExecutionContext) => Promise<Response>;
};

export function createMcpRoute(options: McpRouteOptions = {}) {
  const route = new Hono<{ Bindings: Bindings; Variables: AuthVars }>();

  route.all('/', async (c) => {
    const bearerToken = extractBearerToken(c.req.raw.headers.get('authorization'));
    const sessionCookie = nonEmptyHeader(c.req.raw.headers.get('cookie'));

    // Validate OAuth bearers here so failures include the MCP discovery challenge.
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

    // Reject standalone SSE because stateless MCP handles requests over POST.
    if (c.req.method === 'GET') {
      c.header('Allow', 'POST');
      c.header('Cache-Control', 'no-store');
      return err(c, 'mcp_get_stream_unsupported', 405);
    }

    // Prefer in-process dispatch and retain fetchImpl for tests.
    const dispatch = options.dispatch;
    const fetchImpl: FetchLike | undefined = dispatch
      ? (input, init) =>
          dispatch(new Request(input, init), c.env, c.executionCtx as unknown as ExecutionContext)
      : options.fetchImpl;

    const serverFactory = () =>
      createAntennaMcpServer({
        baseUrl: new URL(c.req.url).origin,
        token: bearerToken ?? undefined,
        sessionCookie: bearerToken === null ? sessionCookie : undefined,
        fetchImpl,
      });

    if (await isLegacyRequest(c.req.raw)) {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const server = serverFactory();
      await server.connect(transport);
      try {
        return await transport.handleRequest(c.req.raw);
      } finally {
        await transport.close();
      }
    }

    const handler = createMcpHandler(serverFactory, {
      legacy: 'reject',
    });

    try {
      return await handler.fetch(c.req.raw);
    } finally {
      await handler.close();
    }
  });

  return route;
}

function nonEmptyHeader(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
