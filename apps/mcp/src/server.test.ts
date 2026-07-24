import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createAntennaMcpServer, readConfigFromEnv } from './server';

describe('createAntennaMcpServer', () => {
  it('registers and serves read-only tools over MCP', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const fetches: string[] = [];
    const server = createAntennaMcpServer({
      baseUrl: 'https://collection.example',
      sessionCookie: 'session-value',
      fetchImpl: (input, init) => {
        const request = new Request(input, init);
        const url = request.url;
        fetches.push(`${request.method} ${url}`);
        if (request.method === 'POST' && url.endsWith('/api/signals/signal-1/refresh')) {
          return Promise.resolve(Response.json({ requested: true }));
        }
        if (request.method === 'PATCH' && url.endsWith('/api/signals/signal-1')) {
          return Promise.resolve(
            Response.json({
              updated: true,
              config: { pair: 'GBP-USD' },
              refresh_seconds: 600,
              cleared_points: true,
            }),
          );
        }
        if (request.method === 'DELETE' && url.endsWith('/api/signals/signal-1')) {
          return Promise.resolve(Response.json({ deleted: true }));
        }
        if (
          request.method === 'PATCH' &&
          url.endsWith('/api/collections/collection-1/signals/order')
        ) {
          return Promise.resolve(
            Response.json({ updated: true, ordered_signal_ids: ['signal-1', 'signal-2'] }),
          );
        }
        if (request.method === 'GET' && url.endsWith('/api/collections')) {
          return Promise.resolve(
            Response.json({
              collections: [
                {
                  id: 'collection-1',
                  title: 'Antenna',
                  description: null,
                  visibility: 'private',
                  slug: null,
                  updated_at: 1,
                  signal_count: 1,
                },
              ],
            }),
          );
        }
        if (request.method === 'POST' && url.endsWith('/api/plan')) {
          return Promise.resolve(
            Response.json({
              id: 'plan-1',
              collection_id: 'collection-1',
              prompt: 'track CHF/USD',
              status: 'proposed',
              plan: { prompt: 'track CHF/USD', signals: [], unmatched: [] },
              created_at: 1,
            }),
          );
        }
        if (request.method === 'POST' && url.endsWith('/api/plan/plan-1/reject')) {
          return Promise.resolve(Response.json({ ok: true }));
        }
        if (request.method === 'POST' && url.endsWith('/api/plan/plan-1/confirm')) {
          return Promise.resolve(Response.json({ created_signal_ids: ['signal-2'] }));
        }
        const body = {
          id: 'signal-1',
          template_id: 'github_trending',
          config: {},
          refresh_seconds: 300,
          display: {
            title: 'GitHub Trending',
            source_label: 'GitHub',
            source_url: 'https://github.com/trending',
          },
          status: {
            status: 'live',
            last_ok_at: 1,
            last_attempt_at: 1,
            last_error: null,
            last_manual_request_at: null,
          },
          points: [{ dimensions: null, value: 12, observed_at: 1, fetched_at: 1 }],
        };
        if (request.method === 'GET' && url.endsWith('/api/collections/collection-1')) {
          return Promise.resolve(
            Response.json({
              collection: {
                id: 'collection-1',
                title: 'Antenna',
                description: null,
                visibility: 'private',
                slug: null,
                layout: null,
                updated_at: 1,
              },
              signals: [body],
            }),
          );
        }
        return Promise.resolve(
          Response.json(url.endsWith('/api/signals/signal-1') ? body : [body]),
        );
      },
    });
    const client = new Client({ name: 'antenna-mcp-test', version: '0.1.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const resources = await client.listResources();
    const resourceTemplates = await client.listResourceTemplates();
    const prompts = await client.listPrompts();
    const result = await client.callTool({
      name: 'list_signals',
      arguments: { collectionId: 'collection-1' },
    });
    const collectionsResult = await client.callTool({ name: 'list_collections', arguments: {} });
    const collectionResult = await client.callTool({
      name: 'get_collection',
      arguments: { collectionId: 'collection-1' },
    });
    const signalResult = await client.callTool({
      name: 'get_signal',
      arguments: { signalId: 'signal-1' },
    });
    const resource = await client.readResource({ uri: 'collection://current' });
    const signalResource = await client.readResource({ uri: 'signals://signal-1' });
    const prompt = await client.getPrompt({ name: 'morning_brief', arguments: {} });
    const refreshResult = await client.callTool({
      name: 'refresh_signal',
      arguments: { signalId: 'signal-1' },
    });
    const updateResult = await client.callTool({
      name: 'update_signal',
      arguments: { signalId: 'signal-1', config: { pair: 'GBP-USD' }, refreshSeconds: 600 },
    });
    const removeResult = await client.callTool({
      name: 'remove_signal',
      arguments: { signalId: 'signal-1' },
    });
    const reorderResult = await client.callTool({
      name: 'reorder_signals',
      arguments: { collectionId: 'collection-1', orderedSignalIds: ['signal-1', 'signal-2'] },
    });
    const proposeResult = await client.callTool({
      name: 'propose_signal',
      arguments: { prompt: 'track CHF/USD' },
    });
    const rejectResult = await client.callTool({
      name: 'reject_plan',
      arguments: { planId: 'plan-1' },
    });
    const confirmResult = await client.callTool({
      name: 'confirm_plan',
      arguments: { planId: 'plan-1', editedSignals: [{ config: { pair: 'CHF-USD' } }] },
    });

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      'confirm_plan',
      'get_collection',
      'get_signal',
      'get_signal_history',
      'list_collections',
      'list_connector_requests',
      'list_signals',
      'list_templates',
      'propose_signal',
      'refresh_signal',
      'reject_plan',
      'remove_signal',
      'reorder_signals',
      'update_signal',
    ]);
    expect(resources.resources.map((resource) => resource.uri)).toEqual(['collection://current']);
    expect(resourceTemplates.resourceTemplates.map((resource) => resource.uriTemplate)).toEqual([
      'signals://{signal_id}',
    ]);
    expect(prompts.prompts.map((item) => item.name)).toEqual(['morning_brief']);
    expect(JSON.stringify(result)).toContain('GitHub Trending');
    expect(JSON.stringify(collectionsResult)).toContain('Antenna');
    expect(JSON.stringify(collectionResult)).toContain('GitHub Trending');
    expect(JSON.stringify(signalResult)).toContain('signal-1');
    expect(JSON.stringify(resource)).toContain('GitHub Trending');
    expect(JSON.stringify(signalResource)).toContain('signal-1');
    expect(JSON.stringify(prompt)).toContain('list_collections first');
    expect(JSON.stringify(refreshResult)).toContain('requested');
    expect(JSON.stringify(updateResult)).toContain('cleared_points');
    expect(JSON.stringify(removeResult)).toContain('deleted');
    expect(JSON.stringify(reorderResult)).toContain('ordered_signal_ids');
    expect(JSON.stringify(proposeResult)).toContain('plan-1');
    expect(JSON.stringify(rejectResult)).toContain('ok');
    expect(JSON.stringify(confirmResult)).toContain('signal-2');
    expect(fetches).toEqual([
      'GET https://collection.example/api/signals?collection_id=collection-1',
      'GET https://collection.example/api/collections',
      'GET https://collection.example/api/collections/collection-1',
      'GET https://collection.example/api/signals/signal-1',
      'GET https://collection.example/api/signals',
      'GET https://collection.example/api/signals/signal-1',
      'POST https://collection.example/api/signals/signal-1/refresh',
      'PATCH https://collection.example/api/signals/signal-1',
      'DELETE https://collection.example/api/signals/signal-1',
      'PATCH https://collection.example/api/collections/collection-1/signals/order',
      'POST https://collection.example/api/plan',
      'POST https://collection.example/api/plan/plan-1/reject',
      'POST https://collection.example/api/plan/plan-1/confirm',
    ]);

    await client.close();
    await server.close();
  });
});

describe('readConfigFromEnv', () => {
  it('requires either a session cookie or token', () => {
    expect(() => readConfigFromEnv({})).toThrow(/ANTENNA_SESSION or ANTENNA_TOKEN/);
  });

  it('requires an explicit deployment base URL', () => {
    expect(() => readConfigFromEnv({ ANTENNA_TOKEN: 'pbk_test' })).toThrow(/ANTENNA_BASE_URL/);
    expect(
      readConfigFromEnv({
        ANTENNA_BASE_URL: 'https://collection.example',
        ANTENNA_TOKEN: 'pbk_test',
      }),
    ).toEqual({
      baseUrl: 'https://collection.example',
      token: 'pbk_test',
      sessionCookie: undefined,
    });
  });
});
