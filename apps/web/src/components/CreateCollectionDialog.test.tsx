// Render-only tests. The submit + navigate flow is exercised in e2e.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import type { CollectionTemplateRecord } from '../api';
import { CreateCollectionDialog, templateSignalSummary } from './CreateCollectionDialog';

describe('CreateCollectionDialog', () => {
  it('renders the title input, optional description, and primary submit', () => {
    const html = renderToString(<CreateCollectionDialog onClose={() => {}} />);
    expect(html).toContain('data-testid="create-collection-dialog"');
    expect(html).toContain('data-testid="create-collection-title"');
    expect(html).toContain('data-testid="create-collection-description"');
    expect(html).toContain('data-testid="create-collection-submit"');
    expect(html).toContain('data-testid="create-collection-template-blank"');
    expect(html).toContain('New collection');
    expect(html).toContain('Start from');
    expect(html).toContain('Loading templates...');
    expect(html).toContain('New collections start private.');
  });

  it('disables the submit button until the title has content', () => {
    const html = renderToString(<CreateCollectionDialog onClose={() => {}} />);
    // Empty default → button is disabled.
    expect(html).toMatch(/<button[^>]*disabled[^>]*data-testid="create-collection-submit"/);
  });

  it('summarises template signal lists compactly', () => {
    const template = {
      id: 'founder-morning',
      kind: 'curated',
      label: 'Founder Morning',
      description: 'Daily operating view',
      summary: 'Core signals',
      signals: [
        { template_id: 'market-overview', display_name: 'Market overview', title: 'Market' },
        { template_id: 'github-trending', display_name: 'GitHub Trending', title: 'GitHub' },
        {
          template_id: 'uk-economic-calendar',
          display_name: 'UK economic calendar',
          title: 'UK calendar',
        },
        { template_id: 'weather', display_name: 'Weather', title: 'Weather' },
      ],
    } satisfies CollectionTemplateRecord;

    expect(templateSignalSummary(template)).toBe('4 signals: Market, GitHub, UK calendar, +1 more');
  });
});
