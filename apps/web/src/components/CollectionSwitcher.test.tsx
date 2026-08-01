// String rendering covers the closed trigger; e2e covers the fetched menu.
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
    // The parent title is the fallback before menu data loads.
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
