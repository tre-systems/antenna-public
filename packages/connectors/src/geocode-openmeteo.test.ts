import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocode } from './geocode-openmeteo';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('geocode', () => {
  it('returns a GeocodeHit with numeric lat/lon and a composed resolvedName', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            name: 'Paris',
            latitude: 48.8566,
            longitude: 2.3522,
            admin1: 'Île-de-France',
            country: 'France',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const hit = await geocode('Paris');
    expect(hit).toEqual({
      lat: 48.8566,
      lon: 2.3522,
      resolvedName: 'Paris, Île-de-France, France',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('geocoding-api.open-meteo.com');
    expect(calledUrl).toContain('name=Paris');
    expect(calledUrl).toContain('count=1');
  });

  it('returns null when results array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })));
    expect(await geocode('Atlantis')).toBeNull();
  });

  it('returns null on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    expect(await geocode('Paris')).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    expect(await geocode('Paris')).toBeNull();
  });

  it('returns null for empty/whitespace input without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await geocode('')).toBeNull();
    expect(await geocode('   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
