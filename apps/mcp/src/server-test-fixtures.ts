import type { FetchLike } from './client';

const SIGNAL = {
  id: 'signal-1',
  template_id: 'github_trending',
  config: {},
  refresh_seconds: 300,
  display: {
    title: 'GitHub Trending',
    source_label: 'GitHub',
    source_url: 'https://github.com/trending',
  },
  status: {
    status: 'live',
    last_ok_at: 1,
    last_attempt_at: 1,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [{ dimensions: null, value: 12, observed_at: 1, fetched_at: 1 }],
};

const COLLECTION = {
  id: 'collection-1',
  title: 'Antenna',
  description: null,
  visibility: 'private',
  slug: null,
  updated_at: 1,
};

const ROUTES: ReadonlyArray<readonly [string, unknown]> = [
  ['POST /api/signals/signal-1/refresh', { requested: true }],
  [
    'PATCH /api/signals/signal-1',
    { updated: true, config: { pair: 'GBP-USD' }, refresh_seconds: 600, cleared_points: true },
  ],
  ['DELETE /api/signals/signal-1', { deleted: true }],
  [
    'PATCH /api/collections/collection-1/signals/order',
    { updated: true, ordered_signal_ids: ['signal-1', 'signal-2'] },
  ],
  ['GET /api/collections', { collections: [{ ...COLLECTION, signal_count: 1 }] }],
  [
    'GET /api/collections/collection-1',
    { collection: { ...COLLECTION, layout: null }, signals: [SIGNAL] },
  ],
  [
    'POST /api/plan',
    {
      id: 'plan-1',
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      status: 'proposed',
      plan: { prompt: 'track CHF/USD', signals: [], unmatched: [] },
      created_at: 1,
    },
  ],
  ['POST /api/plan/plan-1/reject', { ok: true }],
  ['POST /api/plan/plan-1/confirm', { created_signal_ids: ['signal-2'] }],
  ['GET /api/signals/signal-1', SIGNAL],
];

/** Stubs every Worker route the MCP server calls, appending "METHOD url" to `fetches`. */
export function recordingWorkerFetch(fetches: string[]): FetchLike {
  return (input, init) => {
    const request = new Request(input, init);
    fetches.push(`${request.method} ${request.url}`);
    const path = new URL(request.url).pathname;
    const match = ROUTES.find(([route]) => route === `${request.method} ${path}`);
    return Promise.resolve(Response.json(match ? match[1] : [SIGNAL]));
  };
}
