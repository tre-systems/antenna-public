// Exercises the DO's fan-out via its public `fetch` surface. We stub the bits
// of DurableObjectState the constructor reads (nothing, currently); the rest
// is plain Web platform — TransformStream, ReadableStream, fetch Request.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionChannel, encodeSseChunk, encodeSseKeepalive } from './collection-channel';

const makeChannel = (): CollectionChannel => {
  // The constructor doesn't touch state/env in v0 — pass minimal stubs.
  const state = {} as unknown as DurableObjectState;
  return new CollectionChannel(state, {});
};

const readChunk = async (reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> => {
  const { value } = await reader.read();
  if (!value) return '';
  return new TextDecoder().decode(value);
};

const drainPending = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expectedPrefix: string,
): Promise<string> => {
  let acc = '';
  for (let i = 0; i < 5; i += 1) {
    acc += await readChunk(reader);
    if (acc.includes(expectedPrefix)) return acc;
  }
  return acc;
};

const readerFor = (res: Response): ReadableStreamDefaultReader<Uint8Array> => {
  const body = res.body;
  if (!body) throw new Error('expected a response body');
  return body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
};

describe('encodeSseChunk', () => {
  it('serialises to a data: frame terminated with a blank line', () => {
    const bytes = encodeSseChunk({ type: 'signal_updated', signal_id: 'b1' });
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('data: {"type":"signal_updated","signal_id":"b1"}\n\n');
  });

  it('keepalive is an SSE comment so browsers ignore the payload', () => {
    expect(new TextDecoder().decode(encodeSseKeepalive())).toBe(':keepalive\n\n');
  });
});

describe('CollectionChannel.fetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('notify with zero writers returns a readable acknowledgement', async () => {
    const channel = makeChannel();
    const res = await channel.fetch(
      new Request('https://do/notify', {
        method: 'POST',
        body: JSON.stringify({ type: 'signal_updated', signal_id: 'b1' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('subscribed writer receives the notify payload', async () => {
    const channel = makeChannel();
    const sub = await channel.fetch(new Request('https://do/subscribe'));
    expect(sub.status).toBe(200);
    expect(sub.headers.get('content-type')).toBe('text/event-stream');
    const reader = readerFor(sub);
    // First chunk is the prime keepalive.
    expect(await readChunk(reader)).toBe(':keepalive\n\n');

    await channel.fetch(
      new Request('https://do/notify', {
        method: 'POST',
        body: JSON.stringify({ type: 'signal_updated', signal_id: 'b1' }),
      }),
    );
    const text = await drainPending(reader, 'data:');
    expect(text).toContain('data: {"type":"signal_updated","signal_id":"b1"}');
  });

  it('returns 404 for unknown paths', async () => {
    const channel = makeChannel();
    const res = await channel.fetch(new Request('https://do/whatever'));
    expect(res.status).toBe(404);
  });

  it('cancelling the reader stops keepalive without throwing on subsequent notify', async () => {
    const channel = makeChannel();
    const sub = await channel.fetch(new Request('https://do/subscribe'));
    const reader = readerFor(sub);
    await readChunk(reader); // prime keepalive
    await reader.cancel();

    // Subsequent notify must not throw — closed writer should be cleaned up.
    const res = await channel.fetch(
      new Request('https://do/notify', {
        method: 'POST',
        body: JSON.stringify({ type: 'signal_updated', signal_id: 'b1' }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
