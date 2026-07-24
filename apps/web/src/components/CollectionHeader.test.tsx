// Lightweight render-only tests. Editing flow (click, input, save) requires
// a real DOM and is exercised in e2e instead.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { CollectionHeader } from './CollectionHeader';

const noop = async (): Promise<void> => {};

describe('CollectionHeader', () => {
  it('renders the title inside the click-to-edit button', () => {
    const html = renderToString(<CollectionHeader title="Morning Signals" onSaveTitle={noop} />);
    expect(html).toContain('data-testid="collection-title"');
    expect(html).toContain('Morning Signals');
    expect(html).toContain('Click to edit');
  });

  it('does not render the old collection subtitle area', () => {
    const html = renderToString(<CollectionHeader title="Antenna" onSaveTitle={noop} />);
    expect(html).not.toContain('data-testid="collection-description"');
    expect(html).not.toContain('Live signals, all in one place.');
  });
});
