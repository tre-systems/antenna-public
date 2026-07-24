import { describe, expect, it, vi } from 'vitest';
import renderToString from 'preact-render-to-string';
import type { User } from '../auth';
import { OnboardingShell } from './OnboardingShell';

const user: User = {
  id: 'u1',
  email: 'owner@example.com',
  name: 'Test User',
  image_url: null,
  first_seen_at: 1000,
  onboarded_at: null,
  collection_quota: { used: 1, limit: 10, remaining: 9, can_create: true },
};

describe('OnboardingShell', () => {
  it('renders the three deliberate start paths', () => {
    const html = renderToString(
      <OnboardingShell
        user={user}
        saving={false}
        error={null}
        onUseStarter={vi.fn()}
        onCreateCollection={vi.fn()}
        onAddSignal={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="onboarding-shell"');
    expect(html).toContain('data-testid="onboarding-use-starter"');
    expect(html).toContain('data-testid="onboarding-create-collection"');
    expect(html).toContain('data-testid="onboarding-add-signal"');
    expect(html).toContain('Use starter collection');
    expect(html).toContain('Template or blank');
    expect(html).toContain('Add a signal');
  });

  it('shows a precise error when completion fails', () => {
    const html = renderToString(
      <OnboardingShell
        user={user}
        saving={false}
        error="Could not finish onboarding."
        onUseStarter={vi.fn()}
        onCreateCollection={vi.fn()}
        onAddSignal={vi.fn()}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not finish onboarding.');
  });
});
