import { describe, expect, it } from 'vitest';
import { beforeSend } from './sentry';

describe('browser Sentry privacy', () => {
  it('removes OAuth queries and shared-link capabilities', async () => {
    const event = await beforeSend(
      {
        type: undefined,
        request: {
          url: 'https://antenna.example/api/shared/collections/share-secret?code=oauth-code',
          query_string: { code: 'oauth-code' },
        },
      },
      {},
    );

    expect(event?.request?.url).toBe('https://antenna.example/api/shared/collections/[Filtered]');
    expect(event?.request).not.toHaveProperty('query_string');
  });
});
