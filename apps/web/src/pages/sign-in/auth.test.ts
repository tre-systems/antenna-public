// The callback error string is a Worker-to-browser contract.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readErrorFromQuery } from './auth';

const withQuery = (search: string): void => {
  vi.stubGlobal('window', { location: { search } });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readErrorFromQuery', () => {
  it('returns null when the callback carried no error', () => {
    withQuery('');
    expect(readErrorFromQuery()).toBeNull();

    withQuery('?collection=abc');
    expect(readErrorFromQuery()).toBeNull();
  });

  it('classifies the message the Worker actually throws for a blocked account', () => {
    withQuery(`?error=${encodeURIComponent('Account blocked')}`);
    expect(readErrorFromQuery()).toEqual({ kind: 'blocked', raw: 'Account blocked' });
  });

  it('distinguishes an address a closed deployment has not invited', () => {
    withQuery(`?error=${encodeURIComponent('Account not_invited')}`);
    expect(readErrorFromQuery()?.kind).toBe('not_invited');
  });

  it('treats a cancelled Google consent as retryable, not as a block', () => {
    // Published consent makes access_denied a cancellation, not an operator refusal.
    withQuery('?error=access_denied');
    expect(readErrorFromQuery()?.kind).toBe('generic');
  });

  it('falls back to generic for anything unrecognised', () => {
    withQuery('?error=server_error');
    expect(readErrorFromQuery()).toEqual({ kind: 'generic', raw: 'server_error' });
  });
});
