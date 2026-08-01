// Guard static OAuth-facing legal copy that has no component coverage.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const page = (name: 'terms' | 'privacy'): string =>
  readFileSync(fileURLToPath(new URL(`../public/${name}/index.html`, import.meta.url)), 'utf8');

// Prose wraps across lines in the source HTML, so match against a flattened copy.
const prose = (name: 'terms' | 'privacy'): string => page(name).replace(/\s+/g, ' ');

const PAGES = ['terms', 'privacy'] as const;

// Wording that only made sense while access was gated by an allowlist.
const CLOSED_ACCESS_CLAIMS = [
  /invite-only/i,
  /\bwhitelist\b/i,
  /private preview/i,
  /who invited you/i,
];

describe.each(PAGES)('%s page', (name) => {
  it('does not claim access is invite-only', () => {
    const html = prose(name);
    for (const claim of CLOSED_ACCESS_CLAIMS) {
      expect(html, `${name} still matches ${String(claim)}`).not.toMatch(claim);
    }
  });

  it('directs users to the deployment operator', () => {
    expect(prose(name)).toMatch(/contact (the|method supplied by the) operator/i);
  });
});

describe('privacy page', () => {
  it('keeps the Google scope disclosure accurate', () => {
    // New Google scopes must update this OAuth-facing copy before shipping.
    expect(prose('privacy')).toMatch(
      /does not request access to Google Calendar, Gmail, Drive, or other Google account data/i,
    );
  });

  it('states that a blocked address loses access immediately', () => {
    expect(prose('privacy')).toMatch(/block an email address/i);
  });
});

describe('terms page', () => {
  it('states that blocking ends sessions and agent access', () => {
    const html = prose('terms');
    expect(html).toMatch(/block an email address/i);
    expect(html).toMatch(/ends any signed-in session/i);
  });
});
