import { describe, expect, it } from 'vitest';
import { cookieWriteAllowed } from './request-origin';

const origin = 'https://antenna.example.test';
const request = (headers: HeadersInit, method = 'POST') =>
  new Request(`${origin}/api/plan`, { method, headers });

describe('cookie write origin boundary', () => {
  it.each([
    'https://evil.example.test',
    'https://antenna.example.test.evil.test',
    'null',
    'http://antenna.example.test',
    'http://localhost:5173',
  ])('rejects untrusted Origin %s', (untrusted) => {
    expect(cookieWriteAllowed(request({ origin: untrusted }), origin)).toBe(false);
  });
  it.each(['cross-site', 'same-site', 'none'])(
    'rejects originless browser writes from %s',
    (site) => {
      expect(cookieWriteAllowed(request({ 'sec-fetch-site': site }), origin)).toBe(false);
    },
  );
  it('allows exact origin, browser same-origin, and non-browser MCP calls', () => {
    expect(cookieWriteAllowed(request({ origin }), origin)).toBe(true);
    expect(cookieWriteAllowed(request({ 'sec-fetch-site': 'same-origin' }), origin)).toBe(true);
    expect(cookieWriteAllowed(request({}), origin)).toBe(true);
    expect(cookieWriteAllowed(request({ origin: 'https://evil.test' }, 'GET'), origin)).toBe(true);
  });
  it('permits the local frontend only for a local auth origin', () => {
    expect(
      cookieWriteAllowed(request({ origin: 'http://localhost:5173' }), 'http://localhost:8787'),
    ).toBe(true);
  });
});
