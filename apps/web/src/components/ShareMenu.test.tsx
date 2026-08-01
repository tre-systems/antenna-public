// Popover and clipboard interactions remain e2e coverage.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { ShareMenu } from './ShareMenu';

const noop = async (): Promise<void> => {};

describe('ShareMenu', () => {
  it('renders a single Share trigger and keeps the popover closed', () => {
    const html = renderToString(<ShareMenu visibility="private" slug={null} onChange={noop} />);
    expect(html).toContain('data-testid="share-open"');
    expect(html).toContain('aria-label="Share collection"');
    expect(html).toContain('aria-haspopup="dialog"');
    // Closed popover content must not leak into toolbar markup.
    expect(html).not.toContain('data-testid="share-menu"');
    expect(html).not.toContain('data-testid="visibility-private"');
    expect(html).not.toContain('data-testid="share-url"');
  });

  it('shows a live-link indicator only when the collection is shared', () => {
    const privateHtml = renderToString(
      <ShareMenu visibility="private" slug="abc123" onChange={noop} />,
    );
    expect(privateHtml).not.toContain('A read-only link is live');

    const sharedHtml = renderToString(
      <ShareMenu visibility="shared" slug="abc123" onChange={noop} />,
    );
    expect(sharedHtml).toContain('A read-only link is live');
  });
});
