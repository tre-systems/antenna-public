import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import type { CollectionRecord } from '../api';
import {
  humanSkippedReason,
  PublishTemplateDialog,
  publishTemplateErrorMessage,
} from './PublishTemplateDialog';

const collection: CollectionRecord = {
  id: 'collection-1',
  title: 'Public Signals',
  description: 'Reusable morning collection',
  visibility: 'public',
  slug: 'public-signals',
  layout: null,
  updated_at: 0,
};

describe('PublishTemplateDialog', () => {
  it('renders publication fields and the primary action', () => {
    const html = renderToString(
      <PublishTemplateDialog collection={collection} onClose={() => {}} />,
    );

    expect(html).toContain('data-testid="publish-template-dialog"');
    expect(html).toContain('data-testid="publish-template-label"');
    expect(html).toContain('data-testid="publish-template-description"');
    expect(html).toContain('data-testid="publish-template-summary"');
    expect(html).toContain('data-testid="publish-template-submit"');
    expect(html).toContain('Shareable signals become reusable.');
  });

  it('maps backend errors to useful copy', () => {
    expect(
      publishTemplateErrorMessage(
        new Error('POST /api/collections/a/template → 409: collection_not_public'),
      ),
    ).toBe('Make the collection public before publishing it as a template.');
    expect(
      publishTemplateErrorMessage(
        new Error('POST /api/collections/a/template → 409: no_template_signals'),
      ),
    ).toBe('No shareable signals can be published yet. Mark eligible signals public first.');
  });

  it('humanises skipped signal reasons', () => {
    expect(humanSkippedReason('source_not_public_display_eligible')).toBe(
      'source policy signals public reuse',
    );
    expect(humanSkippedReason('signal_not_public')).toBe('signal visibility is not public');
    expect(humanSkippedReason('custom_reason')).toBe('custom reason');
  });
});
