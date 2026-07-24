import { afterEach, describe, expect, it, vi } from 'vitest';
import { restGeneric } from './rest-generic';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('restGeneric', () => {
  it('resolves a numeric value via dot path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { price: 99.5 } })));

    const result = await restGeneric({
      url: 'https://example.com/x',
      jsonPath: 'data.price',
      label: 'price',
      unit: 'USD',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.value).toBe(99.5);
    expect(result.points[0]?.unit).toBe('USD');
    expect(result.points[0]?.dimensions).toEqual({ label: 'price' });
  });

  it('resolves a string value via bracketed path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ result: { items: [{ count: 'seven' }] } })),
    );

    const result = await restGeneric({
      url: 'https://example.com/x',
      jsonPath: 'result.items[0].count',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]?.value).toBe('seven');
    expect(result.points[0]?.dimensions).toEqual({ label: 'result.items[0].count' });
  });

  it('returns parse_failed when path does not resolve', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ a: 1 })));

    const result = await restGeneric({
      url: 'https://example.com/x',
      jsonPath: 'missing.path',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('maps non-2xx to fetch_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    const result = await restGeneric({ url: 'https://example.com/x', jsonPath: 'a' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
  });

  it('maps malformed JSON to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('xxx', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    );
    const result = await restGeneric({ url: 'https://example.com/x', jsonPath: 'a' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });
});
