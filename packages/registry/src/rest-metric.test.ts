import { afterEach, describe, expect, it, vi } from 'vitest';
import { restMetricTemplate } from './rest-metric';

const anyHintMatches = (prompt: string): boolean =>
  restMetricTemplate.matchHints.some((rx) => rx.test(prompt));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('restMetricTemplate.matchHints', () => {
  it.each([
    'pull data from https://example.com/api',
    'I have a REST endpoint',
    'call this api for me',
    'use the endpoint at https://x.test/y',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Berlin', 'bitcoin price', 'football scores'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('restMetricTemplate.paramExtractors.url', () => {
  const { url, jsonPath } = restMetricTemplate.paramExtractors;

  it('extracts the first http(s) URL', () => {
    expect(url?.('please fetch https://example.com/api/v1/x for me')).toBe(
      'https://example.com/api/v1/x',
    );
  });

  it('strips trailing punctuation', () => {
    expect(url?.('see https://example.com/api.')).toBe('https://example.com/api');
  });

  it('returns undefined when there is no URL', () => {
    expect(url?.('just some words')).toBeUndefined();
  });

  it('jsonPath extractor returns undefined (planner-driven)', () => {
    expect(jsonPath?.('https://example.com/api')).toBeUndefined();
  });
});

describe('restMetricTemplate.adapter', () => {
  it('errors when jsonPath is missing', async () => {
    const result = await restMetricTemplate.adapter({ url: 'https://example.com/x' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('delegates to restGeneric when jsonPath is supplied', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ a: { b: 5 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const result = await restMetricTemplate.adapter({
      url: 'https://example.com/x',
      jsonPath: 'a.b',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]?.value).toBe(5);
  });
});
