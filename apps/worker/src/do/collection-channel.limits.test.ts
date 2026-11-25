import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CollectionChannel,
  SSE_MAX_BUFFER_BYTES,
  SSE_MAX_CONNECTIONS,
  SSE_MAX_LIFETIME_MS,
} from './collection-channel';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
const channel = (): CollectionChannel => new CollectionChannel({} as DurableObjectState, {});
const subscribe = (c: CollectionChannel): Promise<Response> =>
  c.fetch(new Request('https://do/subscribe'));
const notify = (c: CollectionChannel, size = 1000): Promise<Response> =>
  c.fetch(
    new Request('https://do/notify', {
      method: 'POST',
      body: JSON.stringify({ type: 'updated', value: 'x'.repeat(size) }),
    }),
  );

it('caps concurrent subscriptions and frees the slot and timer on cancellation', async () => {
  const c = channel();
  const responses = await Promise.all(
    Array.from({ length: SSE_MAX_CONNECTIONS }, () => subscribe(c)),
  );
  expect(responses.every((r) => r.status === 200)).toBe(true);
  const limited = await subscribe(c);
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('30');
  expect(vi.getTimerCount()).toBe(SSE_MAX_CONNECTIONS);
  await responses[0]?.body?.cancel();
  const replacement = await subscribe(c);
  expect(replacement.status).toBe(200);
  for (const response of [...responses.slice(1), replacement]) await response.body?.cancel();
  expect(vi.getTimerCount()).toBe(0);
});

it('closes a slow reader before its byte budget is exceeded and stops its timer', async () => {
  const c = channel();
  const response = await subscribe(c);
  for (let i = 0; i < 100; i++) await notify(c);
  expect(vi.getTimerCount()).toBe(0);
  const buffered = await response.arrayBuffer();
  expect(buffered.byteLength).toBeGreaterThan(0);
  expect(buffered.byteLength).toBeLessThanOrEqual(SSE_MAX_BUFFER_BYTES);
});

it('expires even a healthy reader and permits a replacement connection', async () => {
  const c = channel();
  const response = await subscribe(c);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('missing stream');
  await reader.read();
  for (let elapsed = 0; elapsed < SSE_MAX_LIFETIME_MS; elapsed += 20_000) {
    vi.advanceTimersByTime(20_000);
    const chunk = await reader.read();
    if (chunk.done) break;
  }
  expect((await reader.read()).done).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  const replacement = await subscribe(c);
  expect(replacement.status).toBe(200);
  await replacement.body?.cancel();
});
