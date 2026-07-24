import type { ApiSignal, SignalStatusValue } from '@antenna/shared';
import { describe, expect, it } from 'vitest';
import { type FetchLike, createAntennaReadClient } from './client';
import { getSignalHistoryTool, listSignalsTool } from './tools';

describe('createAntennaReadClient', () => {
  it('sends session-cookie auth and lists signals', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
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
    const client = createAntennaReadClient({
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
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetch(requests, [signal({ id: 'one', template_id: 'github_trending' })]),
    });

    await client.listSignals({ collectionId: 'collection/a' });

    expect(requests[0]?.url).toBe(
      'https://collection.example/api/signals?collection_id=collection%2Fa',
    );
  });

  it('filters signals by template and status for MCP list_signals', async () => {
    const client = createAntennaReadClient({
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
    const client = createAntennaReadClient({
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
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      fetchImpl: jsonFetch(requests, signal({ id: 'two', template_id: 'market_history' })),
    });

    await expect(client.getSignal('two')).resolves.toMatchObject({ id: 'two' });
    expect(requests[0]?.url).toBe('https://collection.example/api/signals/two');
  });

  it('returns null for unknown signal ids', async () => {
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      fetchImpl: () => Promise.resolve(Response.json({ error: 'not_found' }, { status: 404 })),
    });

    await expect(client.getSignal('missing')).resolves.toBeNull();
  });

  it('fetches signal history with the requested range', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
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

  it('requests an owner-scoped manual refresh for a signal', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, { requested: true }),
    });

    await expect(client.refreshSignal('signal/a')).resolves.toEqual({ requested: true });

    expect(requests[0]?.url).toBe('https://collection.example/api/signals/signal%2Fa/refresh');
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
  });

  it('patches an owner-scoped signal config through the Worker route', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, {
        updated: true,
        config: { pair: 'GBP-USD' },
        refresh_seconds: 600,
        cleared_points: true,
      }),
    });

    await expect(
      client.updateSignal('signal/a', {
        config: { pair: 'GBP-USD' },
        refresh_seconds: 600,
      }),
    ).resolves.toEqual({
      updated: true,
      config: { pair: 'GBP-USD' },
      refresh_seconds: 600,
      cleared_points: true,
    });

    expect(requests[0]?.url).toBe('https://collection.example/api/signals/signal%2Fa');
    expect(requests[0]?.method).toBe('PATCH');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
    expect(requests[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(await requests[0]?.json()).toEqual({
      config: { pair: 'GBP-USD' },
      refresh_seconds: 600,
    });
  });

  it('deletes an owner-scoped signal through the Worker route', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, { deleted: true }),
    });

    await expect(client.removeSignal('signal/a')).resolves.toEqual({ deleted: true });

    expect(requests[0]?.url).toBe('https://collection.example/api/signals/signal%2Fa');
    expect(requests[0]?.method).toBe('DELETE');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
  });

  it('reorders collection signals through the owner-scoped collection order route', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, {
        updated: true,
        ordered_signal_ids: ['signal-b', 'signal-a'],
      }),
    });

    await expect(client.reorderSignals(['signal-b', 'signal-a'])).resolves.toEqual({
      updated: true,
      ordered_signal_ids: ['signal-b', 'signal-a'],
    });

    expect(requests[0]?.url).toBe('https://collection.example/api/collection/signals/order');
    expect(requests[0]?.method).toBe('PATCH');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
    expect(requests[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(await requests[0]?.json()).toEqual({
      ordered_signal_ids: ['signal-b', 'signal-a'],
    });
  });

  it('reorders signals through a collection-id-scoped order route when provided', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, {
        updated: true,
        ordered_signal_ids: ['signal-b', 'signal-a'],
      }),
    });

    await expect(client.reorderSignals(['signal-b', 'signal-a'], 'collection/a')).resolves.toEqual({
      updated: true,
      ordered_signal_ids: ['signal-b', 'signal-a'],
    });

    expect(requests[0]?.url).toBe(
      'https://collection.example/api/collections/collection%2Fa/signals/order',
    );
    expect(requests[0]?.method).toBe('PATCH');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
    expect(await requests[0]?.json()).toEqual({
      ordered_signal_ids: ['signal-b', 'signal-a'],
    });
  });

  it('lists collections and fetches one collection detail by id', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
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

  it('posts a natural-language signal proposal prompt', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      sessionCookie: 'session-value',
      fetchImpl: jsonFetch(requests, {
        id: 'plan-1',
        collection_id: 'collection-1',
        prompt: 'track CHF/USD',
        status: 'proposed',
        plan: { prompt: 'track CHF/USD', signals: [], unmatched: [] },
        created_at: 1,
      }),
    });

    const plan = await client.proposeSignal('track CHF/USD');

    expect(plan.id).toBe('plan-1');
    expect(requests[0]?.url).toBe('https://collection.example/api/plan');
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(await requests[0]?.json()).toEqual({ prompt: 'track CHF/USD' });
  });

  it('rejects an owner-scoped pending plan', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, { ok: true }),
    });

    await expect(client.rejectPlan('plan/a')).resolves.toEqual({ ok: true });

    expect(requests[0]?.url).toBe('https://collection.example/api/plan/plan%2Fa/reject');
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
  });

  it('confirms a user-approved plan with optional missing-field patches', async () => {
    const requests: Request[] = [];
    const client = createAntennaReadClient({
      baseUrl: 'https://collection.example',
      token: 'api-token',
      fetchImpl: jsonFetch(requests, { created_signal_ids: ['signal-1'] }),
    });

    await expect(
      client.confirmPlan('plan/a', {
        edited_signals: [{ config: { location: 'London' } }],
      }),
    ).resolves.toEqual({ created_signal_ids: ['signal-1'] });

    expect(requests[0]?.url).toBe('https://collection.example/api/plan/plan%2Fa/confirm');
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer api-token');
    expect(requests[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(await requests[0]?.json()).toEqual({
      edited_signals: [{ config: { location: 'London' } }],
    });
  });

  it('throws a typed API error with status and response body', async () => {
    const client = createAntennaReadClient({
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

function jsonFetch(requests: Request[], body: unknown): FetchLike {
  return (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(Response.json(body));
  };
}

function jsonFetchBody(body: unknown): FetchLike {
  return () => Promise.resolve(Response.json(body));
}

function signal(overrides: {
  readonly id: string;
  readonly template_id: string;
  readonly status?: SignalStatusValue | null;
  readonly last_ok_at?: number | null;
  readonly last_attempt_at?: number | null;
}): ApiSignal {
  return {
    id: overrides.id,
    template_id: overrides.template_id,
    visibility: 'private',
    config: {},
    refresh_seconds: 300,
    display: {
      title: overrides.id,
      source_label: 'Example',
      source_url: 'https://example.com',
    },
    status: {
      status: overrides.status === undefined ? 'live' : overrides.status,
      last_ok_at: overrides.last_ok_at === undefined ? 1 : overrides.last_ok_at,
      last_attempt_at: overrides.last_attempt_at === undefined ? 1 : overrides.last_attempt_at,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [{ dimensions: null, value: 10, observed_at: 1, fetched_at: 1 }],
  };
}
