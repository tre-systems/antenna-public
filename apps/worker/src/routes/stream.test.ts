import { describe, expect, it } from 'vitest';
import { collectionSubscriptionRequest } from './stream';

describe('collectionSubscriptionRequest', () => {
  it('does not attach an external abort signal to the Durable Object subscription', () => {
    const subscription = collectionSubscriptionRequest();
    expect(subscription.url).toBe('https://do/subscribe');
    expect(subscription.signal.aborted).toBe(false);
  });
});
