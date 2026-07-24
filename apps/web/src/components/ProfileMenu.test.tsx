// Render-only tests.  Outside-click + Escape close behaviour needs a real
// DOM and is covered manually + by other dropdown tests in the codebase.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { ProfileMenu } from './ProfileMenu';
import type { User } from '../auth';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'owner@example.com',
  name: 'Test User',
  image_url: null,
  first_seen_at: 0,
  onboarded_at: 0,
  collection_quota: { used: 1, limit: 5, remaining: 4, can_create: true },
  ...overrides,
});

describe('ProfileMenu', () => {
  it('renders the avatar trigger with initials', () => {
    const html = renderToString(
      <ProfileMenu user={makeUser()} signingOut={false} onSignOut={() => {}} />,
    );
    expect(html).toContain('data-testid="profile-menu-trigger"');
    expect(html).toContain('>TU<');
    // Menu body is closed by default — only the trigger should be in the DOM.
    expect(html).not.toContain('data-testid="profile-menu"');
  });

  it('falls back to email initial when the user has no name', () => {
    const html = renderToString(
      <ProfileMenu user={makeUser({ name: '' })} signingOut={false} onSignOut={() => {}} />,
    );
    expect(html).toContain('>O<');
  });

  it('uses the profile image when available', () => {
    const html = renderToString(
      <ProfileMenu
        user={makeUser({ image_url: 'https://lh3.googleusercontent.com/a/test-avatar' })}
        signingOut={false}
        onSignOut={() => {}}
      />,
    );
    expect(html).toContain('src="https://lh3.googleusercontent.com/a/test-avatar"');
    expect(html).not.toContain('>TU<');
  });

  it('exposes the greeting via aria-label so screen readers still announce it', () => {
    const html = renderToString(
      <ProfileMenu user={makeUser()} signingOut={false} onSignOut={() => {}} />,
    );
    // greetingFor() depends on local hour (see auth.ts), so accept every
    // time-of-day branch — the assertion is on the aria-label shape and the
    // user's first name, not the specific greeting.
    expect(html).toMatch(
      /aria-label="Account menu — (Up late|Good (morning|afternoon|evening)), Test"/,
    );
  });
});
