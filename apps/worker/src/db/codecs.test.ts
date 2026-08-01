import { describe, expect, it } from 'vitest';
import { canonicalJson, parseJsonRecord, parseStringRecord, toTimestampMs } from './codecs';

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
    expect(parseJsonRecord('[]')).toEqual({});
  });

  it('parses string-valued dimension records', () => {
    expect(parseStringRecord('{"symbol":"BA.L"}')).toEqual({ symbol: 'BA.L' });
    expect(parseStringRecord('{"rank":2}')).toEqual({ rank: '2' });
    expect(parseStringRecord('{"nested":{}}')).toBeNull();
    expect(parseStringRecord('[]')).toBeNull();
    expect(parseStringRecord(null)).toBeNull();
  });

  it('canonicalises object identity without changing array order', () => {
    expect(canonicalJson({ b: 2, a: { y: 2, x: 1 } })).toBe(
      canonicalJson({ a: { x: 1, y: 2 }, b: 2 }),
    );
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    expect(() => canonicalJson(1n)).toThrow('not JSON serializable');
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
