import { describe, expect, it, vi } from 'vitest';
import { notifyCollection } from './notify';

type FetchCall = { readonly url: string; readonly init: RequestInit | undefined };

const makeChannels = (fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) => {
  const calls: FetchCall[] = [];
  const idFromName = vi.fn((name: string) => ({ toString: () => `id-of-${name}` }));
  const stub = {
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return fetchImpl(url, init);
    }),
  };
  const namespace = {
    idFromName,
    get: vi.fn(() => stub),
  } as unknown as DurableObjectNamespace;
  return { calls, namespace, stub, idFromName };
};

describe('notifyCollection', () => {
  it('no-ops when CHANNELS is unbound', async () => {
    await expect(notifyCollection({}, 'collection-1', { type: 'x' })).resolves.toBeUndefined();
  });

  it('routes to idFromName(collectionId) and POSTs the event JSON', async () => {
    const { calls, namespace, idFromName } = makeChannels(() =>
      Promise.resolve(new Response('ok')),
    );
    await notifyCollection({ CHANNELS: namespace }, 'collection-1', {
      type: 'signal_updated',
      signal_id: 'b1',
      fetched_at: 1234,
    });
    expect(idFromName).toHaveBeenCalledWith('collection-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://do/notify');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ type: 'signal_updated', signal_id: 'b1', fetched_at: 1234 }),
    );
  });

  it('consumes the acknowledgement after notifying', async () => {
    const arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const response = { arrayBuffer } as unknown as Response;
    const { namespace } = makeChannels(() => Promise.resolve(response));

    await notifyCollection({ CHANNELS: namespace }, 'collection-1', { type: 'x' });

    expect(arrayBuffer).toHaveBeenCalledOnce();
  });

  it('swallows fetch errors so the caller never sees the failure', async () => {
    const { namespace } = makeChannels(() => Promise.reject(new Error('boom')));
    await expect(
      notifyCollection({ CHANNELS: namespace }, 'collection-1', { type: 'x' }),
    ).resolves.toBeUndefined();
  });
});
