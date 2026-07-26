import { describe, expect, it } from 'vitest';
import { createAntennaReadClient } from './client';
import { jsonFetch } from './client-test-fixtures';

describe('createAntennaReadClient mutations', () => {
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
});
