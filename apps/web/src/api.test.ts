import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmPlan,
  createCollection,
  deleteSignal,
  deleteCollection,
  getAlerts,
  getSignal,
  getSignals,
  getSignalHistory,
  getSharedCollection,
  getCollection,
  getCollectionTemplates,
  getConnectorRequests,
  getNotificationPreferences,
  getTemplates,
  publishCollectionTemplate,
  rejectPlan,
  reorderSignals,
  submitPrompt,
  updateCollection,
  updateSignal,
  updateNotificationPreference,
} from './api';
import type { PlanRecord, ProposedSignal } from '@antenna/shared';

type FetchArgs = Parameters<typeof fetch>;
type FetchImpl = (...args: FetchArgs) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function urlOf(input: FetchArgs[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function captureFetch(body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl: FetchImpl = (input, init) => {
    calls.push({ url: urlOf(input), init });
    return Promise.resolve(jsonResponse(body));
  };
  vi.stubGlobal('fetch', vi.fn(impl));
  return calls;
}

const samplePlan: PlanRecord = {
  id: 'p1',
  collection_id: 'd1',
  prompt: 'track CHF/USD',
  status: 'proposed',
  plan: { prompt: 'track CHF/USD', signals: [], unmatched: [] },
  created_at: 0,
};

const sampleSignal: ProposedSignal = {
  template_id: 'fx-pair',
  display_name: 'CHF/USD',
  config: { base: 'CHF', quote: 'USD' },
  missing: [],
  refresh_seconds: 60,
  rights_status: 'public',
  source_label: 'Frankfurter (ECB)',
};

describe('api plan endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submitPrompt POSTs to /api/plan with the prompt body', async () => {
    const calls = captureFetch(samplePlan);
    const result = await submitPrompt('track CHF/USD');
    expect(result).toEqual(samplePlan);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/plan');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ prompt: 'track CHF/USD' }));
  });

  it('submitPrompt can target a selected collection', async () => {
    const calls = captureFetch({ ...samplePlan, collection_id: 'collection/selected' });
    const result = await submitPrompt('track CHF/USD', 'collection/selected');
    expect(result.collection_id).toBe('collection/selected');
    expect(calls[0]?.url).toBe('/api/plan');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ prompt: 'track CHF/USD', collection_id: 'collection/selected' }),
    );
  });

  it('submitPrompt omits an undefined collection id', async () => {
    const calls = captureFetch(samplePlan);
    await submitPrompt('track CHF/USD', undefined);
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ prompt: 'track CHF/USD' }));
  });

  it('confirmPlan POSTs edited signals to /api/plan/:id/confirm', async () => {
    const calls = captureFetch({ created_signal_ids: ['b1'] });
    const result = await confirmPlan('p1', [sampleSignal]);
    expect(result.created_signal_ids).toEqual(['b1']);
    expect(calls[0]?.url).toBe('/api/plan/p1/confirm');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ edited_signals: [{ config: sampleSignal.config }] }),
    );
  });

  it('rejectPlan POSTs to /api/plan/:id/reject', async () => {
    const calls = captureFetch({ ok: true });
    const result = await rejectPlan('p1');
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe('/api/plan/p1/reject');
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('getConnectorRequests GETs /api/requests', async () => {
    const calls = captureFetch([]);
    const result = await getConnectorRequests();
    expect(result).toEqual([]);
    expect(calls[0]?.url).toBe('/api/requests');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getTemplates GETs the registry template metadata endpoint', async () => {
    const calls = captureFetch([
      {
        id: 'fx-pair',
        display_name: 'FX pair',
        param_keys: ['base', 'quote'],
        planner_enabled: true,
        rights_status: 'public',
        default_refresh_seconds: 900,
        retain_raw_payload: false,
        server_secret_required: false,
        setup_message: null,
        source_policy: null,
      },
    ]);
    const result = await getTemplates();
    expect(result[0]?.id).toBe('fx-pair');
    expect(calls[0]?.url).toBe('/api/templates');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getCollectionTemplates GETs the collection template picker endpoint', async () => {
    const calls = captureFetch({
      templates: [
        {
          id: 'founder-morning',
          kind: 'curated',
          label: 'Founder Morning',
          description: 'Daily operating view',
          summary: 'Core signals',
          signals: [],
        },
      ],
    });
    const result = await getCollectionTemplates();
    expect(result.templates[0]?.id).toBe('founder-morning');
    expect(calls[0]?.url).toBe('/api/templates/collections');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getCollection GETs the current collection endpoint', async () => {
    const calls = captureFetch({
      id: 'collection-1',
      title: 'Antenna',
      description: null,
      visibility: 'private',
      slug: null,
      layout: null,
      updated_at: 0,
    });
    const result = await getCollection();
    expect(result.id).toBe('collection-1');
    expect(calls[0]?.url).toBe('/api/collection');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getSignals can scope the list endpoint to one collection id', async () => {
    const calls = captureFetch([]);
    await getSignals('collection/with spaces');
    expect(calls[0]?.url).toBe('/api/signals?collection_id=collection%2Fwith+spaces');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getSignal GETs one encoded owner-scoped signal', async () => {
    const calls = captureFetch({ id: 'signal/with spaces' });
    const result = await getSignal('signal/with spaces');
    expect(result.id).toBe('signal/with spaces');
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('createCollection POSTs collection metadata and optional template id', async () => {
    const calls = captureFetch({
      id: 'collection-2',
      title: 'Founder Morning',
      description: 'Template-backed collection',
      visibility: 'private',
      slug: null,
      layout: null,
      updated_at: 20,
    });
    const result = await createCollection({
      title: 'Founder Morning',
      description: 'Template-backed collection',
      template_id: 'founder-morning',
    });

    expect(result.id).toBe('collection-2');
    expect(calls[0]?.url).toBe('/api/collections');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({
        title: 'Founder Morning',
        description: 'Template-backed collection',
        template_id: 'founder-morning',
      }),
    );
  });

  it('updateCollection PATCHes collection metadata and layout', async () => {
    const layout = { version: 1, slots: [{ signal_id: 'b1', x: 0, y: 0, w: 6, h: 4 }] };
    const calls = captureFetch({
      id: 'collection-1',
      title: 'Morning collection',
      description: 'Daily operating view',
      visibility: 'private',
      slug: null,
      layout,
      updated_at: 10,
    });
    const result = await updateCollection({
      title: 'Morning collection',
      description: 'Daily operating view',
      layout,
    });
    expect(result.layout).toEqual(layout);
    expect(calls[0]?.url).toBe('/api/collection');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({
        title: 'Morning collection',
        description: 'Daily operating view',
        layout,
      }),
    );
  });

  it('updateCollection uses the collection-scoped route when a collection id is provided', async () => {
    const calls = captureFetch({
      id: 'collection/with spaces',
      title: 'Team collection',
      description: null,
      visibility: 'public',
      slug: 'team-collection',
      layout: null,
      updated_at: 20,
    });

    const result = await updateCollection(
      { title: 'Team collection', visibility: 'public' },
      'collection/with spaces',
    );

    expect(result.id).toBe('collection/with spaces');
    expect(calls[0]?.url).toBe('/api/collections/collection%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ title: 'Team collection', visibility: 'public' }),
    );
  });

  it('getSignalHistory GETs the signal history endpoint with a range', async () => {
    const calls = captureFetch({ points: [] });
    const result = await getSignalHistory('signal/with spaces', '6m');
    expect(result).toEqual({ points: [] });
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces/history?range=6m');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getAlerts GETs recent alerts with optional filters', async () => {
    const calls = captureFetch({ alerts: [] });
    const result = await getAlerts({ collection_id: 'collection/1', since: 1000, limit: 20 });
    expect(result).toEqual({ alerts: [] });
    expect(calls[0]?.url).toBe('/api/alerts?collection_id=collection%2F1&since=1000&limit=20');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getNotificationPreferences GETs global or collection scoped preferences', async () => {
    const calls = captureFetch({ preferences: [] });
    await getNotificationPreferences('collection/1');
    expect(calls[0]?.url).toBe('/api/notifications/preferences?collection_id=collection%2F1');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('updateNotificationPreference PATCHes a channel preference', async () => {
    const body = {
      preference: {
        collection_id: null,
        channel: 'daily_digest',
        enabled: true,
        frequency: 'daily',
        quiet_hours_start: null,
        quiet_hours_end: null,
        updated_at: 10,
      },
    };
    const calls = captureFetch(body);
    const result = await updateNotificationPreference('daily_digest', {
      enabled: true,
      frequency: 'weekly',
    });
    expect(result).toEqual(body);
    expect(calls[0]?.url).toBe('/api/notifications/preferences/daily_digest');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ enabled: true, frequency: 'weekly' }));
  });

  it('updateSignal PATCHes config and refresh changes to the signal endpoint', async () => {
    const calls = captureFetch({
      updated: true,
      config: { base: 'GBP', quote: 'USD' },
      refresh_seconds: 600,
      cleared_points: true,
    });
    const result = await updateSignal('signal/with spaces', {
      config: { base: 'GBP' },
      refresh_seconds: 600,
    });
    expect(result.updated).toBe(true);
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ config: { base: 'GBP' }, refresh_seconds: 600 }),
    );
  });

  it('deleteSignal DELETEs the encoded signal endpoint', async () => {
    const calls = captureFetch({ deleted: true });
    const result = await deleteSignal('signal/with spaces');
    expect(result.deleted).toBe(true);
    expect(calls[0]?.url).toBe('/api/signals/signal%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('deleteCollection DELETEs the encoded collection endpoint', async () => {
    const calls = captureFetch({ deleted: true, id: 'collection/with spaces' });
    const result = await deleteCollection('collection/with spaces');
    expect(result).toEqual({ deleted: true, id: 'collection/with spaces' });
    expect(calls[0]?.url).toBe('/api/collections/collection%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('reorderSignals uses the collection-scoped route when a collection id is provided', async () => {
    const calls = captureFetch({ updated: true, ordered_signal_ids: ['b', 'a'] });
    await reorderSignals(['b', 'a'], 'collection/with spaces');
    expect(calls[0]?.url).toBe('/api/collections/collection%2Fwith%20spaces/signals/order');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ ordered_signal_ids: ['b', 'a'] }));
  });

  it('getSharedCollection GETs the shared-link endpoint', async () => {
    const body = { collection: { id: 'c1' }, signals: [] };
    const calls = captureFetch(body);
    const result = await getSharedCollection('shared/slug');
    expect(result).toEqual(body);
    expect(calls[0]?.url).toBe('/api/shared/collections/shared%2Fslug');
  });

  it('publishCollectionTemplate POSTs owner publication details', async () => {
    const body = {
      template: {
        id: 'collection:public-slug',
        kind: 'community',
        label: 'Public Signals',
        description: 'A reusable signal set',
        summary: 'Three public signals',
        source_collection_id: 'collection-1',
        fork_source_slug: 'public-slug',
        owner_display_name: 'Example Owner',
        signals: [],
      },
      skipped_signals: [],
    };
    const calls = captureFetch(body);
    const result = await publishCollectionTemplate('collection/with spaces', {
      label: 'Public Signals',
      description: 'A reusable signal set',
      summary: 'Three public signals',
    });

    expect(result).toEqual(body);
    expect(calls[0]?.url).toBe('/api/collections/collection%2Fwith%20spaces/template');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({
        label: 'Public Signals',
        description: 'A reusable signal set',
        summary: 'Three public signals',
      }),
    );
  });
});
