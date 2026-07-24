// preact-render-to-string renders synchronously, so the fetch-driven loading
// path is what's visible in HTML output.  Loaded / not-found states are
// exercised in e2e against the real Worker.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { PublicCollection } from './PublicCollection';

describe('PublicCollection', () => {
  it('renders the sign-in CTA in the header on every state', () => {
    const html = renderToString(<PublicCollection slug="abc123" />);
    expect(html).toContain('data-testid="public-cta-sign-in"');
    expect(html).toContain('Sign in');
    expect(html).not.toContain('data-testid="public-cta-discover"');
    expect(html).not.toContain('data-testid="public-cta-fork"');
    expect(html).not.toContain('data-testid="public-cta-report"');
  });

  it('shows the loading placeholder while the public read is in flight', () => {
    const html = renderToString(<PublicCollection slug="abc123" />);
    expect(html).toContain('data-testid="public-loading"');
  });

  it('uses a generic title until the public collection payload arrives', () => {
    const html = renderToString(<PublicCollection slug="abc123" />);
    expect(html).toContain('Antenna');
  });
});
