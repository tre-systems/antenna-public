import { describe, expect, it } from 'vitest';
import { toPointRow } from './point-row';

describe('toPointRow', () => {
  it('persists adapter source URLs on data point rows', () => {
    const row = toPointRow(
      'signal-1',
      {
        dimensions: { metric: 'value' },
        value: 123,
        ts: 1_700_000_000_000,
        sourceUrl: 'https://example.test/source',
      },
      1_700_000_100_000,
      'payload.json',
    );

    expect(row.fetchedAt).toEqual(new Date(1_700_000_100_000));
    expect(row.observedAt).toEqual(new Date(1_700_000_000_000));
    expect(row.sourceUrl).toBe('https://example.test/source');
  });

  it('supports sources that do not retain raw payloads', () => {
    const row = toPointRow(
      'signal-1',
      {
        dimensions: { metric: 'value' },
        value: 123,
        ts: 1_700_000_000_000,
        sourceUrl: 'https://example.test/source',
      },
      1_700_000_100_000,
      null,
    );

    expect(row.rawPayloadId).toBeNull();
  });
});
