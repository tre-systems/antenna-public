// Render-only tests via preact-render-to-string. The submit flow needs a
// real DOM and is exercised in e2e.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { ReportCollectionDialog } from './ReportCollectionDialog';

describe('ReportCollectionDialog', () => {
  it('renders the four category radios with broken checked by default', () => {
    const html = renderToString(<ReportCollectionDialog slug="abc" onClose={() => {}} />);
    expect(html).toContain('data-testid="report-collection-dialog"');
    expect(html).toContain('data-testid="report-category-broken"');
    expect(html).toContain('data-testid="report-category-inappropriate"');
    expect(html).toContain('data-testid="report-category-spam"');
    expect(html).toContain('data-testid="report-category-other"');
    expect(html).toMatch(/<input[^>]*checked[^>]*data-testid="report-category-broken"/);
  });

  it('renders the optional message textarea + submit button', () => {
    const html = renderToString(<ReportCollectionDialog slug="abc" onClose={() => {}} />);
    expect(html).toContain('data-testid="report-collection-message"');
    expect(html).toContain('data-testid="report-collection-submit"');
    expect(html).toContain('Send report');
  });
});
