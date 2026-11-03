import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryOAuthRead } from './oauth-read-retry';

const transient = () =>
  new Error('Failed query: redacted', {
    cause: new Error('D1_ERROR: internal error; reference = test', {
      cause: new Error('internal error'),
    }),
  });

describe('OAuth D1 read retries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits 100 then 200 ms and succeeds on the third attempt', async () => {
    const read = vi.fn().mockRejectedValueOnce(transient()).mockRejectedValueOnce(transient());
    read.mockResolvedValueOnce('current grant');
    const result = retryOAuthRead(read);
    await vi.advanceTimersByTimeAsync(99);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('current grant');
    expect(read).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rethrows the final failure after exactly three attempts', async () => {
    const error = transient();
    const read = vi.fn().mockRejectedValue(error);
    const rejected = expect(retryOAuthRead(read)).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await rejected;
    expect(read).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    new Error('internal error'),
    new Error('D1_ERROR: no such table: oauth_access_token'),
    new Error('D1_ERROR: unauthorized'),
    new Error('D1_ERROR: constraint failed'),
    new Error('Failed query: SELECT "D1_ERROR: internal error"'),
    new Error('D1_ERROR: internal errorish'),
    new Error('Network connection lost'),
    { message: 'D1_ERROR: internal error' },
    'D1_ERROR: internal error',
  ])('does not retry unrecognized failures (%s)', async (error) => {
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryOAuthRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds cyclic cause traversal', async () => {
    const error = new Error('not transient');
    error.cause = error;
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryOAuthRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('stops immediately if a retry produces a different failure', async () => {
    const error = new Error('D1_ERROR: no such column');
    const read = vi.fn().mockRejectedValueOnce(transient()).mockRejectedValue(error);
    const rejected = expect(retryOAuthRead(read)).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await rejected;
    expect(read).toHaveBeenCalledTimes(2);
  });
});
