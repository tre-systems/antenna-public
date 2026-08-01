import { describe, expect, it } from 'vitest';
import { pointSourceUrl, signalSourceLabel, signalSourceUrl, signalTitle } from './display';
import { makeSignal } from './test-support';

describe('pointSourceUrl', () => {
  it('prefers server-resolved point display source URLs', () => {
    expect(
      pointSourceUrl(
        {
          dimensions: { ticker: 'VTI.US' },
          value: 360,
          source_url: 'https://legacy.example/source',
          display: { label: 'VTI', source_url: 'https://server.example/source' },
        },
        makeSignal({ template_id: 'equity-watchlist' }),
      ),
    ).toBe('https://server.example/source');
  });

  it('drops executable point links', () => {
    expect(
      pointSourceUrl(
        {
          dimensions: {},
          value: 1,
          display: { label: 'Unsafe', source_url: 'javascript:alert(1)' },
        },
        makeSignal({ template_id: 'manual-metric' }),
      ),
    ).toBeNull();
  });

  it('uses a safe legacy point URL when display metadata is absent', () => {
    expect(
      pointSourceUrl(
        { dimensions: {}, value: 1, source_url: 'https://legacy.example/source' },
        makeSignal(),
      ),
    ).toBe('https://legacy.example/source');
  });
});

describe('signalTitle', () => {
  it('prefers server-resolved display titles when available', () => {
    expect(
      signalTitle(
        makeSignal({
          template_id: 'fx-pair',
          config: { base: 'EUR', quote: 'USD' },
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('Server title');
  });

  it('uses stored title as a compatibility fallback', () => {
    expect(signalTitle(makeSignal({ title: 'Stored title' }))).toBe('Stored title');
  });
});

describe('signalSourceLabel', () => {
  it('prefers server-resolved source labels when available', () => {
    expect(
      signalSourceLabel(
        makeSignal({
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('Server source');
  });

  it('uses template id as a compatibility fallback', () => {
    expect(signalSourceLabel(makeSignal({ template_id: 'legacy-template' }))).toBe(
      'legacy-template',
    );
  });
});

describe('signalSourceUrl', () => {
  it('prefers server-resolved source URLs when available', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          display: {
            title: 'Server title',
            source_label: 'Server source',
            source_url: 'https://example.test/source',
          },
        }),
      ),
    ).toBe('https://example.test/source');
  });

  it('drops executable signal links', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          template_id: 'rest-metric',
          config: { url: 'javascript:alert(1)' },
          display: { title: 'Unsafe', source_label: 'Unsafe', source_url: 'javascript:alert(1)' },
        }),
      ),
    ).toBeNull();
  });

  it('returns the first point source URL when present', () => {
    expect(
      signalSourceUrl(
        makeSignal({
          points: [
            { dimensions: { label: 'A' }, value: 1, ts: 0 },
            {
              dimensions: { label: 'B' },
              value: 2,
              ts: 0,
              source_url: 'https://example.test/source',
            },
          ],
        }),
      ),
    ).toBe('https://example.test/source');
  });

  it('does not derive links from browser-visible config', () => {
    expect(
      signalSourceUrl(
        makeSignal({ config: { sourceUrl: 'https://untrusted.example/source' }, points: [] }),
      ),
    ).toBeNull();
  });
});
