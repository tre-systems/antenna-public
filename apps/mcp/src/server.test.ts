import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createAntennaMcpServer, readConfigFromEnv } from './server';
import { recordingWorkerFetch } from './server-test-fixtures';

describe('createAntennaMcpServer', () => {
  it('registers and serves read-only tools over MCP', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const fetches: string[] = [];
    const server = createAntennaMcpServer({
      baseUrl: 'https://collection.example',
      sessionCookie: 'session-value',
      fetchImpl: recordingWorkerFetch(fetches),
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
    const appPrompt = await client.getPrompt({ name: 'app_brief', arguments: {} });
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
      arguments: { prompt: 'track CHF/USD', collectionId: 'collection-1' },
    });
    const proposeTemplateResult = await client.callTool({
      name: 'propose_template_signal',
      arguments: { templateId: 'weather', collectionId: 'collection-1' },
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
      'propose_template_signal',
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
    expect(prompts.prompts.map((item) => item.name).sort()).toEqual(['app_brief', 'morning_brief']);
    expect(JSON.stringify(result)).toContain('GitHub Trending');
    expect(JSON.stringify(result)).toContain('second');
    expect(JSON.stringify(result)).toContain('point_count');
    expect(JSON.stringify(collectionsResult)).toContain('Antenna');
    expect(JSON.stringify(collectionResult)).toContain('GitHub Trending');
    expect(JSON.stringify(signalResult)).toContain('signal-1');
    expect(JSON.stringify(resource)).toContain('GitHub Trending');
    expect(JSON.stringify(signalResource)).toContain('signal-1');
    expect(JSON.stringify(prompt)).toContain('list_collections first');
    expect(JSON.stringify(appPrompt)).toContain('instrumentation gap');
    expect(JSON.stringify(appPrompt)).toContain('never report it as user growth');
    expect(JSON.stringify(refreshResult)).toContain('requested');
    expect(JSON.stringify(updateResult)).toContain('cleared_points');
    expect(JSON.stringify(removeResult)).toContain('deleted');
    expect(JSON.stringify(reorderResult)).toContain('ordered_signal_ids');
    expect(JSON.stringify(proposeResult)).toContain('plan-1');
    expect(JSON.stringify(proposeTemplateResult)).toContain('plan-1');
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

  it('uses production as the default base URL', () => {
    expect(readConfigFromEnv({ ANTENNA_TOKEN: 'pbk_test' })).toEqual({
      baseUrl: 'https://antenna.example',
      token: 'pbk_test',
      sessionCookie: undefined,
    });
  });
});
