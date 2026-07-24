import { describe, expect, it } from 'vitest';
import { collectionSubscriptionRequest } from './stream';

describe('collectionSubscriptionRequest', () => {
  it('propagates client cancellation to the Durable Object subscription', () => {
    const controller = new AbortController();
    const incoming = new Request('https://antenna.example/api/collections/c1/stream', {
      signal: controller.signal,
    });

    const subscription = collectionSubscriptionRequest(incoming);
    expect(subscription.url).toBe('https://do/subscribe');
    expect(subscription.signal.aborted).toBe(false);

    controller.abort();
    expect(subscription.signal.aborted).toBe(true);
  });
});
