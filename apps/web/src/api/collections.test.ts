import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCollection,
  deleteCollection,
  getCollection,
  getCollectionTemplates,
  publishCollectionTemplate,
  updateCollection,
} from './collections';
import { captureFetch } from './test-support';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api collection endpoints', () => {
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

  it('deleteCollection DELETEs the encoded collection endpoint', async () => {
    const calls = captureFetch({ deleted: true, id: 'collection/with spaces' });
    const result = await deleteCollection('collection/with spaces');
    expect(result).toEqual({ deleted: true, id: 'collection/with spaces' });
    expect(calls[0]?.url).toBe('/api/collections/collection%2Fwith%20spaces');
    expect(calls[0]?.init?.method).toBe('DELETE');
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
        owner_display_name: 'Rob',
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
