import { describe, expect, it } from 'vitest';
import { isQuotaError } from './quota-error';

describe('quota constraint errors', () => {
  it('recognises direct and wrapped SQLite/D1 errors without matching query parameters', () => {
    const cause = new Error('D1_ERROR: signal_quota_exceeded: SQLITE_CONSTRAINT');
    expect(
      isQuotaError(
        new Error('Failed query with private bindings', { cause }),
        'signal_quota_exceeded',
      ),
    ).toBe(true);
    expect(isQuotaError(new Error('collection_quota_exceeded'), 'collection_quota_exceeded')).toBe(
      true,
    );
    expect(
      isQuotaError(new Error('query params: signal_quota_exceeded'), 'signal_quota_exceeded'),
    ).toBe(false);
    expect(isQuotaError(cause, 'collection_quota_exceeded')).toBe(false);
  });
});
