import type { ApiSignal, SignalStatusValue } from '@antenna/shared';
import type { FetchLike } from './client';

export function jsonFetch(requests: Request[], body: unknown): FetchLike {
  return (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(Response.json(body));
  };
}

export function jsonFetchBody(body: unknown): FetchLike {
  return () => Promise.resolve(Response.json(body));
}

export function signal(overrides: {
  readonly id: string;
  readonly template_id: string;
  readonly status?: SignalStatusValue | null;
  readonly last_ok_at?: number | null;
  readonly last_attempt_at?: number | null;
}): ApiSignal {
  return {
    id: overrides.id,
    template_id: overrides.template_id,
    visibility: 'private',
    config: {},
    refresh_seconds: 300,
    display: {
      title: overrides.id,
      source_label: 'Example',
      source_url: 'https://example.com',
    },
    status: {
      status: overrides.status === undefined ? 'live' : overrides.status,
      last_ok_at: overrides.last_ok_at === undefined ? 1 : overrides.last_ok_at,
      last_attempt_at: overrides.last_attempt_at === undefined ? 1 : overrides.last_attempt_at,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [{ dimensions: null, value: 10, observed_at: 1, fetched_at: 1 }],
  };
}
