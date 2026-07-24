import { describe, expect, it } from 'vitest';
import { resolveJsonPath } from './json-path';

describe('resolveJsonPath', () => {
  it('resolves a simple dot path (a.b)', () => {
    expect(resolveJsonPath({ a: { b: 7 } }, 'a.b')).toBe(7);
  });

  it('resolves a bare array index (a[0])', () => {
    expect(resolveJsonPath({ a: [10, 20] }, 'a[0]')).toBe(10);
  });

  it('resolves field after index (a[0].b)', () => {
    expect(resolveJsonPath({ a: [{ b: 'hi' }] }, 'a[0].b')).toBe('hi');
  });

  it('resolves nested mixed path (a.b[1].c)', () => {
    expect(resolveJsonPath({ a: { b: [{ c: 1 }, { c: 2 }] } }, 'a.b[1].c')).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    expect(resolveJsonPath({ a: 1 }, 'a.b')).toBeUndefined();
    expect(resolveJsonPath({}, 'a')).toBeUndefined();
    expect(resolveJsonPath({ a: [] }, 'a[5]')).toBeUndefined();
  });

  it('returns undefined when applying a path to null/primitive', () => {
    expect(resolveJsonPath(null, 'a')).toBeUndefined();
    expect(resolveJsonPath(42, 'a')).toBeUndefined();
  });

  it('returns undefined for malformed bracket syntax', () => {
    expect(resolveJsonPath({ a: [1] }, 'a[0')).toBeUndefined();
  });
});
