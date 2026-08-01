import { describe, expect, it } from 'vitest';
import { createAntennaClient } from './client';
import { jsonFetch, jsonFetchBody, signal } from './client-test-fixtures';
import { getSignalHistoryTool, listSignalsTool } from './tools';

describe('createAntennaClient reads', () => {
  it('sends session-cookie auth and lists signals', async () => {
    const requests: Request[] = [];
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      sessionCookie: 'session-value',
      fetchImpl: jsonFetch(requests, [signal({ id: 'one', template_id: 'github_trending' })]),
    });

    const signals = await client.listSignals();

    expect(signals).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://collection.example/api/signals');
    expect(requests[0]?.headers.get('Cookie')).toBe('better-auth.session_token=session-value');
  });

  it('preserves full cookie headers and bearer auth', async () => {
    const requests: Request[] = [];
    const client = createAntennaClient({
      baseUrl: 'https://collection.example/',
      sessionCookie: 'better-auth.session_token=abc; other=value',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, []),
    });

    await client.listSignals();

    expect(requests[0]?.headers.get('Cookie')).toBe('better-auth.session_token=abc; other=value');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
  });

  it('passes a collection id filter to the signal list endpoint', async () => {
    const requests: Request[] = [];
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetch(requests, [signal({ id: 'one', template_id: 'github_trending' })]),
    });

    await client.listSignals({ collectionId: 'collection/a' });

    expect(requests[0]?.url).toBe(
      'https://collection.example/api/signals?collection_id=collection%2Fa',
    );
  });

  it('filters signals by template and status for MCP list_signals', async () => {
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetchBody([
        signal({ id: 'one', template_id: 'github_trending', status: 'live' }),
        signal({ id: 'two', template_id: 'market_history', status: 'error' }),
        signal({ id: 'three', template_id: 'market_history', status: 'live' }),
      ]),
    });

    const signals = await listSignalsTool(client, { templateId: 'market_history', status: 'live' });

    expect(signals).toHaveLength(1);
    expect(signals[0]?.id).toBe('three');
    expect(signals[0]?.template_id).toBe('market_history');
    expect(signals[0]?.latest_point?.value).toBe(10);
  });

  it('treats never-attempted null-status signals as loading in list filters', async () => {
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetchBody([
        signal({
          id: 'one',
          template_id: 'market_history',
          status: null,
          last_ok_at: null,
          last_attempt_at: null,
        }),
        signal({ id: 'two', template_id: 'market_history', status: 'live' }),
      ]),
    });

    const signals = await client.listSignals({ status: 'loading' });

    expect(signals.map((candidate) => candidate.id)).toEqual(['one']);
  });

  it('loads one signal by id through the owner-scoped signal endpoint', async () => {
    const requests: Request[] = [];
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetch(requests, signal({ id: 'two', template_id: 'market_history' })),
    });

    await expect(client.getSignal('two')).resolves.toMatchObject({ id: 'two' });
    expect(requests[0]?.url).toBe('https://collection.example/api/signals/two');
  });

  it('returns null for unknown signal ids', async () => {
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: () => Promise.resolve(Response.json({ error: 'not_found' }, { status: 404 })),
    });

    await expect(client.getSignal('missing')).resolves.toBeNull();
  });

  it('fetches signal history with the requested range', async () => {
    const requests: Request[] = [];
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetch(requests, {
        points: [
          { metric_key: 'close', value: 10, observed_at: 1, fetched_at: 1, dimensions: null },
        ],
      }),
    });

    const result = await getSignalHistoryTool(client, { signalId: 'signal/a', range: 'all' });

    expect(result.range).toBe('all');
    expect(result.points).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      'https://collection.example/api/signals/signal%2Fa/history?range=all',
    );
  });

  it('lists collections and fetches one collection detail by id', async () => {
    const requests: Request[] = [];
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      sessionCookie: 'session-value',
      fetchImpl: (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        if (request.url.endsWith('/api/collections')) {
          return Promise.resolve(
            Response.json({
              collections: [
                {
                  id: 'collection-1',
                  title: 'Main',
                  description: null,
                  visibility: 'private',
                  slug: null,
                  updated_at: 1,
                  signal_count: 2,
                },
              ],
            }),
          );
        }
        return Promise.resolve(
          Response.json({
            collection: {
              id: 'collection-1',
              title: 'Main',
              description: null,
              visibility: 'private',
              slug: null,
              layout: null,
              updated_at: 1,
            },
            signals: [signal({ id: 'signal-a', template_id: 'github_trending' })],
          }),
        );
      },
    });

    await expect(client.listCollections()).resolves.toEqual([
      {
        id: 'collection-1',
        title: 'Main',
        description: null,
        visibility: 'private',
        slug: null,
        updated_at: 1,
        signal_count: 2,
      },
    ]);
    await expect(client.getCollection('collection-1')).resolves.toMatchObject({
      collection: { id: 'collection-1', title: 'Main' },
      signals: [{ id: 'signal-a' }],
    });

    expect(requests.map((request) => request.url)).toEqual([
      'https://collection.example/api/collections',
      'https://collection.example/api/collections/collection-1',
    ]);
  });

  it('throws a typed API error with status and response body', async () => {
    const client = createAntennaClient({
      baseUrl: 'https://collection.example',
      fetchImpl: () =>
        Promise.resolve(new Response('not signed in', { status: 401, statusText: 'Unauthorized' })),
    });

    await expect(client.listTemplates()).rejects.toMatchObject({
      name: 'AntennaApiError',
      status: 401,
      body: 'not signed in',
    });
  });
});
