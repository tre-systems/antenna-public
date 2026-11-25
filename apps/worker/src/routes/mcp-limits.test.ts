import { MCP_MAX_TOOL_INPUT_ELEMENTS } from '@antenna/mcp/factory';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthVars, MiddlewareEnv } from '../auth/middleware';
import { createMcpRoute, MCP_MAX_REQUEST_BYTES } from './mcp';

function fixture() {
  const dispatch = vi.fn(() => Promise.resolve(Response.json([])));
  const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
  app.route('/api/mcp', createMcpRoute({ fetchImpl: dispatch }));
  return { app, dispatch };
}

function request(args: unknown, modern: boolean, declaredLength?: string) {
  return new Request('https://collection.test/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer pbk_synthetic-test',
      ...(declaredLength ? { 'content-length': declaredLength } : {}),
      ...(modern
        ? {
            'mcp-method': 'tools/call',
            'mcp-name': 'list_signals',
            'mcp-protocol-version': '2026-07-28',
          }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_signals',
        arguments: args,
        ...(modern
          ? {
              _meta: {
                'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                'io.modelcontextprotocol/clientInfo': { name: 'limits-test', version: '0' },
                'io.modelcontextprotocol/clientCapabilities': {},
              },
            }
          : {}),
      },
    }),
  });
}

describe.each([false, true])('MCP bounded validation (modern=%s)', (modern) => {
  it.each(['array', 'object'])('rejects excessive %s elements before dispatch', async (kind) => {
    const { app, dispatch } = fixture();
    const values = Array.from({ length: MCP_MAX_TOOL_INPUT_ELEMENTS }, (_, i) => [String(i), 0]);
    const padding: unknown = kind === 'array' ? values.map(() => 0) : Object.fromEntries(values);
    const res = await app.fetch(request({ padding }, modern));
    expect(res.status, await res.clone().text()).toBe(200);
    const body: { result: { isError: boolean } } = await res.json();
    expect(body.result.isError).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('accepts the element boundary and ordinary calls on fresh servers', async () => {
    const { app, dispatch } = fixture();
    for (const args of [{ padding: Array(MCP_MAX_TOOL_INPUT_ELEMENTS - 1).fill(0) }, {}]) {
      const res = await app.fetch(request(args, modern));
      expect(res.status, await res.clone().text()).toBe(200);
      const body: { result: { isError?: boolean } } = await res.json();
      expect(body.result.isError).not.toBe(true);
    }
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, '1'])('rejects oversized bodies despite length=%s', async (length) => {
    const { app, dispatch } = fixture();
    const res = await app.fetch(
      request({ padding: 'x'.repeat(MCP_MAX_REQUEST_BYTES) }, modern, length),
    );
    expect(res.status).toBe(413);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('preserves the authentication boundary before tool dispatch', async () => {
    const { app, dispatch } = fixture();
    const req = request({}, modern);
    req.headers.delete('authorization');
    expect((await app.fetch(req)).status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
