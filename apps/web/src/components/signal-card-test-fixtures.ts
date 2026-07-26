import type { ApiSignal, PublicApiSignal } from '../api';

export const NOW = Date.now();

export function makeSignal(overrides: Partial<ApiSignal> = {}): ApiSignal {
  return {
    id: 'b-fx-1',
    template_id: 'fx-pair',
    config: { pair: 'EUR/USD' },
    refresh_seconds: 60,
    status: {
      status: 'live',
      last_ok_at: NOW - 10_000,
      last_attempt_at: NOW - 10_000,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [{ dimensions: { pair: 'EUR/USD' }, value: 1.0876, ts: NOW - 10_000 }],
    ...overrides,
    visibility: overrides.visibility ?? 'private',
  };
}

export function makePublicSignal(overrides: Partial<PublicApiSignal> = {}): PublicApiSignal {
  const {
    config: _config,
    refresh_seconds: _refreshSeconds,
    ...base
  } = makeSignal({
    status: {
      status: 'error',
      last_ok_at: null,
      last_attempt_at: NOW - 5_000,
      last_error: 'setup_required: needs TRADING_ECONOMICS_API_KEY',
      last_manual_request_at: null,
    },
    points: [],
  });
  return { ...base, ...overrides };
}
