import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FetchLike } from '@antenna/mcp';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AuthVars, MiddlewareEnv } from '../auth/middleware';
import { createMcpRoute } from './mcp';

const makeApiSignal = (id: string, title: string) => ({
  id,
  template_id: 'github_trending',
  title,
  visibility: 'private',
  config: {},
  refresh_seconds: 300,
  display: { title, source_label: 'GitHub', source_url: 'https://github.com/trending' },
  source_policy: null,
  status: {
    status: 'live',
    last_ok_at: 1,
    last_attempt_at: 1,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [],
});

describe('/api/mcp', () => {
  it('rejects requests without bearer token or session cookie', async () => {
    const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
    app.route('/api/mcp', createMcpRoute());

    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects standalone GET SSE streams instead of leaving the request open', async () => {
    const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
    app.route('/api/mcp', createMcpRoute());

    const res = await app.request('/api/mcp', {
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer pbk_test-token',
      },
    });

    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect(await res.json()).toEqual({ error: 'mcp_get_stream_unsupported' });
  });

  it('serves the shared MCP tool surface over streamable HTTP', async () => {
    const fetches: string[] = [];
    const routeFetch: FetchLike = (input, init) => {
      const request = new Request(input, init);
      fetches.push(`${request.method} ${request.url} ${request.headers.get('authorization')}`);
      return Promise.resolve(
        Response.json([
          {
            id: 'signal-1',
            template_id: 'github_trending',
            title: 'GitHub Trending',
            visibility: 'private',
            config: {},
            refresh_seconds: 300,
            display: {
              title: 'GitHub Trending',
              source_label: 'GitHub',
              source_url: 'https://github.com/trending',
            },
            source_policy: null,
            status: {
              status: 'live',
              last_ok_at: 1,
              last_attempt_at: 1,
              last_error: null,
              last_manual_request_at: null,
            },
            points: [],
          },
        ]),
      );
    };
    const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
    app.route('/api/mcp', createMcpRoute({ fetchImpl: routeFetch }));
    const clientFetch: FetchLike = async (input, init) => app.fetch(new Request(input, init));
    const transport = new StreamableHTTPClientTransport(
      new URL('https://collection.test/api/mcp'),
      {
        requestInit: {
          headers: { authorization: 'Bearer pbk_test-token' },
        },
        fetch: clientFetch,
      },
    );
    const client = new Client({ name: 'antenna-worker-mcp-test', version: '0.1.0' });

    await client.connect(transport);
    const tools = await client.listTools();
    const result = await client.callTool({ name: 'list_signals', arguments: {} });
    await client.close();

    expect(tools.tools.map((tool) => tool.name)).toContain('list_signals');
    expect(JSON.stringify(result)).toContain('GitHub Trending');
    expect(fetches).toEqual(['GET https://collection.test/api/signals Bearer pbk_test-token']);
  });

  it('scopes MCP reads to the caller token so user A cannot read user B signal', async () => {
    const forwarded: string[] = [];
    // Emulate the owner-scoped internal signal API with existence hiding.
    const ownerByToken: Readonly<Record<string, string>> = {
      'Bearer pbk_user-a': 'signal-a',
      'Bearer pbk_user-b': 'signal-b',
    };
    const titlesById: Readonly<Record<string, string>> = {
      'signal-a': 'User A signal',
      'signal-b': 'User B private signal',
    };
    const routeFetch: FetchLike = (input, init) => {
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      const auth = request.headers.get('authorization');
      forwarded.push(`${request.method} ${pathname} ${auth ?? 'none'}`);
      const match = /^\/api\/signals\/([^/]+)$/.exec(pathname);
      const requestedId = match?.[1] !== undefined ? decodeURIComponent(match[1]) : null;
      if (requestedId === null || ownerByToken[auth ?? ''] !== requestedId) {
        return Promise.resolve(Response.json({ error: 'not_found' }, { status: 404 }));
      }
      return Promise.resolve(
        Response.json(makeApiSignal(requestedId, titlesById[requestedId] ?? '')),
      );
    };

    const callGetSignal = async (token: string, signalId: string): Promise<string> => {
      const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
      app.route('/api/mcp', createMcpRoute({ fetchImpl: routeFetch }));
      const clientFetch: FetchLike = async (input, init) => app.fetch(new Request(input, init));
      const transport = new StreamableHTTPClientTransport(
        new URL('https://collection.test/api/mcp'),
        { requestInit: { headers: { authorization: `Bearer ${token}` } }, fetch: clientFetch },
      );
      const client = new Client({ name: 'antenna-worker-mcp-test', version: '0.1.0' });
      await client.connect(transport);
      const result = await client.callTool({ name: 'get_signal', arguments: { signalId } });
      await client.close();
      return JSON.stringify(result);
    };

    // Cross-owner reads must surface no signal data.
    const crossUser = await callGetSignal('pbk_user-a', 'signal-b');
    expect(forwarded).toContain('GET /api/signals/signal-b Bearer pbk_user-a');
    expect(crossUser).not.toContain('User B private signal');
    expect(crossUser).toContain('"text":"null"');

    // Confirm the same path succeeds for the owning caller.
    const ownRead = await callGetSignal('pbk_user-a', 'signal-a');
    expect(ownRead).toContain('User A signal');
  });
});
