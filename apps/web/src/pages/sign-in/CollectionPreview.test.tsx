import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { CollectionPreview } from './CollectionPreview';

describe('CollectionPreview', () => {
  it('shows current illustrative signals and the real agent workflow', () => {
    const html = renderToString(<CollectionPreview />);

    expect(html).toContain('data-testid="sign-in-collection-preview"');
    expect(html).toContain('Daily signals');
    expect(html).toContain('Applications');
    expect(html).toContain('Cloudflare Web Analytics');
    expect(html).toContain('Product actions');
    expect(html).toContain('Built for your agents');
    expect(html).toContain('recurring report');
    expect(html).not.toContain('Codex');
    expect(html).not.toContain('Agent proposal');
    expect(html).not.toContain('Approval required');
    expect(html).not.toContain("Rob's");
  });
});
