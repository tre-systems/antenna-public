import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from './safe-url';

describe('safeExternalUrl', () => {
  it('allows absolute HTTPS source links', () => {
    expect(safeExternalUrl('https://example.test/source')).toBe('https://example.test/source');
  });

  it('rejects executable, credential-bearing, and relative links', () => {
    expect(safeExternalUrl('javascript:alert(document.cookie)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('http://example.test/source')).toBeNull();
    expect(safeExternalUrl('https://user:secret@example.test/')).toBeNull();
    expect(safeExternalUrl('/relative')).toBeNull();
  });
});
