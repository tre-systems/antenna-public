import { describe, expect, it } from 'vitest';
import { errorMessage } from './log';

describe('cron exception privacy', () => {
  it('omits SQL, bound credentials, and arbitrary thrown values', () => {
    expect(errorMessage(new Error('Failed query: INSERT INTO account params: private-token'))).toBe(
      'Operation failed',
    );
    expect(errorMessage('private-token')).toBe('Operation failed');
  });
});
