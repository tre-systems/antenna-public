// Editing interactions require a real DOM and remain e2e coverage.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { CollectionHeader } from './CollectionHeader';

const noop = async (): Promise<void> => {};

describe('CollectionHeader', () => {
  it('renders the title inside the click-to-edit button', () => {
    const html = renderToString(<CollectionHeader title="Rob's Morning" onSaveTitle={noop} />);
    expect(html).toContain('data-testid="collection-title"');
    expect(html).toContain("Rob's Morning");
    expect(html).toContain('Click to edit');
  });

  it('does not render the old collection subtitle area', () => {
    const html = renderToString(<CollectionHeader title="Antenna" onSaveTitle={noop} />);
    expect(html).not.toContain('data-testid="collection-description"');
    expect(html).not.toContain('Live signals, all in one place.');
  });

  it('renders the endorsed brand for the legacy default collection title', () => {
    const html = renderToString(<CollectionHeader title="Antenna" onSaveTitle={noop} />);
    expect(html).toContain('src="/favicon.svg"');
    expect(html).toContain('Antenna');
  });
});
