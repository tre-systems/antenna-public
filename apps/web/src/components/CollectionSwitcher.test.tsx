// Render-only tests via preact-render-to-string. Listing fetch is gated
// behind the open dropdown, so the static markup only covers the trigger.
// The expanded menu + active item highlighting are exercised in e2e.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { CollectionSwitcher } from './CollectionSwitcher';

describe('CollectionSwitcher', () => {
  it('renders the trigger button with the primary collection title', () => {
    const html = renderToString(
      <CollectionSwitcher activeId={null} primaryTitle="Antenna" onCreateClick={() => {}} />,
    );
    expect(html).toContain('data-testid="collection-switcher-trigger"');
    expect(html).toContain('Antenna');
  });

  it('shows the active collection title fallback when no listing has loaded yet', () => {
    // Without the listing fetched, even a non-null activeId falls back to
    // the primary title we got from the parent collection fetch.
    const html = renderToString(
      <CollectionSwitcher activeId="abc123" primaryTitle="Trading desk" onCreateClick={() => {}} />,
    );
    expect(html).toContain('Trading desk');
  });

  it('does not render the menu until opened', () => {
    const html = renderToString(
      <CollectionSwitcher activeId={null} primaryTitle="Antenna" onCreateClick={() => {}} />,
    );
    expect(html).not.toContain('data-testid="collection-switcher-menu"');
  });
});
