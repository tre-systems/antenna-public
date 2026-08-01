import { describe, it, expect } from 'vitest';
import { deriveStatus } from './signal-status';
import type { ApiSignal, SignalStatus } from './api';

const NOW = 1_700_000_000_000;

function makeSignal(status: Partial<SignalStatus>, refresh_seconds = 60): ApiSignal {
  return {
    id: 'b1',
    template_id: 'fx-pair',
    visibility: 'private',
    config: {},
    refresh_seconds,
    status: {
      status: null,
      last_ok_at: null,
      last_attempt_at: null,
      last_error: null,
      last_manual_request_at: null,
      ...status,
    },
    points: [],
  };
}

describe('deriveStatus', () => {
  it('returns loading when never attempted', () => {
    expect(deriveStatus(makeSignal({}), NOW)).toBe('loading');
  });

  it("returns loading when status is 'loading' even if last_attempt_at is populated", () => {
    // A confirmed plan remains loading until its first dispatcher result.
    const signal = makeSignal({ status: 'loading', last_attempt_at: NOW - 500 });
    expect(deriveStatus(signal, NOW)).toBe('loading');
  });

  it('returns error when last_error is set and ok is null', () => {
    const signal = makeSignal({ last_error: 'boom', last_attempt_at: NOW - 1000 });
    expect(deriveStatus(signal, NOW)).toBe('error');
  });

  it('returns error when last_attempt_at is newer than last_ok_at', () => {
    const signal = makeSignal({
      last_error: 'oops',
      last_ok_at: NOW - 5000,
      last_attempt_at: NOW - 1000,
    });
    expect(deriveStatus(signal, NOW)).toBe('error');
  });

  it('returns stale when last_ok_at is older than twice the refresh interval', () => {
    const signal = makeSignal({ last_ok_at: NOW - 121_000, last_attempt_at: NOW - 121_000 }, 60);
    expect(deriveStatus(signal, NOW)).toBe('stale');
  });

  it("honours explicit 'stale' status before surfacing a retained error", () => {
    const signal = makeSignal({
      status: 'stale',
      last_error: 'transient upstream error',
      last_ok_at: NOW - 1_000,
      last_attempt_at: NOW,
    });
    expect(deriveStatus(signal, NOW)).toBe('stale');
  });

  it('returns live in the happy path', () => {
    const signal = makeSignal({ last_ok_at: NOW - 5000, last_attempt_at: NOW - 5000 }, 60);
    expect(deriveStatus(signal, NOW)).toBe('live');
  });

  it('treats a recovered error (ok newer than attempt+error) as live', () => {
    const signal = makeSignal({
      last_error: 'transient',
      last_ok_at: NOW - 1000,
      last_attempt_at: NOW - 5000,
    });
    expect(deriveStatus(signal, NOW)).toBe('live');
  });
});
