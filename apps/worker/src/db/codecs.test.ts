import { describe, expect, it } from 'vitest';
import { parseJsonRecord, parseStringRecord, toTimestampMs } from './codecs';

describe('db codecs', () => {
  it('parses JSON object records from text columns', () => {
    expect(parseJsonRecord('{"base":"GBP","quote":"USD"}')).toEqual({
      base: 'GBP',
      quote: 'USD',
    });
  });

  it('returns an empty object for nullish or scalar JSON record values', () => {
    expect(parseJsonRecord(null)).toEqual({});
    expect(parseJsonRecord(123)).toEqual({});
  });

  it('parses string-valued dimension records', () => {
    expect(parseStringRecord('{"symbol":"AZN.L"}')).toEqual({ symbol: 'AZN.L' });
    expect(parseStringRecord(null)).toBeNull();
  });

  it('preserves malformed JSON failures so callers surface bad persisted data', () => {
    expect(() => parseJsonRecord('{bad json')).toThrow();
    expect(() => parseStringRecord('{bad json')).toThrow();
  });

  it('converts D1 timestamp representations to epoch milliseconds', () => {
    expect(toTimestampMs(new Date(1_700_000_000_000))).toBe(1_700_000_000_000);
    expect(toTimestampMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toTimestampMs(null)).toBeNull();
  });
});
