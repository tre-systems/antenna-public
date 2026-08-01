import { describe, it, expect } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import { makeSignal, NOW } from './signal-card-test-fixtures';

describe('SignalCard source attribution', () => {
  it('links the source label when a point carries a source URL', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          display: {
            title: 'EUR/USD',
            source_label: 'Frankfurter (ECB)',
            source_url: null,
          },
          points: [
            {
              dimensions: { pair: 'EUR/USD' },
              value: 1.0876,
              ts: NOW - 10_000,
              source_url: 'https://example.test/source',
            },
          ],
        })}
      />,
    );
    expect(html).toContain('href="https://example.test/source"');
    expect(html).toContain('target="_blank"');
  });

  it('links macro signals to their source page before data arrives', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'macro-market-history',
          config: { preset: 'uk-10y-gilt' },
          display: {
            title: 'UK 10Y gilt 1Y',
            source_label: 'Bank of England',
            source_url: 'https://www.bankofengland.co.uk/boeapps/database/',
          },
          points: [],
        })}
      />,
    );
    expect(html).toContain('UK 10Y gilt 1Y');
    expect(html).toContain('Bank of England');
    expect(html).toContain('href="https://www.bankofengland.co.uk/boeapps/database/"');
  });

  it('shows owner signals whether their source can be publicly displayed', () => {
    const publicHtml = renderToString(
      <SignalCard
        signal={makeSignal({
          source_policy: {
            source_id: 'frankfurter-ecb',
            label: 'Frankfurter (ECB)',
            source_url: 'https://www.frankfurter.app/',
            rights_status: 'public',
            execution_mode: 'public_cloud',
            public_display_eligible: true,
            public_display_blocker: null,
            attribution: 'Frankfurter, using European Central Bank reference rates',
            last_reviewed: '2026-05-21',
          },
        })}
      />,
    );

    expect(publicHtml).not.toContain('data-testid="source-posture-badge"');
    expect(publicHtml).not.toContain('public-safe');

    const privateHtml = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'market-history',
          source_policy: {
            source_id: 'yahoo-finance-chart',
            label: 'Yahoo Finance',
            source_url: 'https://finance.yahoo.com/',
            rights_status: 'with-attribution',
            execution_mode: 'public_cloud',
            public_display_eligible: false,
            public_display_blocker: 'Private dogfood stopgap for yearly charts.',
            attribution: 'Yahoo Finance',
            last_reviewed: '2026-05-21',
          },
        })}
      />,
    );

    expect(privateHtml).not.toContain('data-source-posture="blocked"');
    expect(privateHtml).not.toContain('private-only');
    expect(privateHtml).not.toContain('Private dogfood stopgap for yearly charts.');
  });

  it('hides the owner source posture badge on read-only public signals', () => {
    const html = renderToString(
      <SignalCard
        readOnly
        signal={makeSignal({
          source_policy: {
            source_id: 'frankfurter-ecb',
            label: 'Frankfurter (ECB)',
            source_url: 'https://www.frankfurter.app/',
            rights_status: 'public',
            execution_mode: 'public_cloud',
            public_display_eligible: true,
            public_display_blocker: null,
            attribution: 'Frankfurter, using European Central Bank reference rates',
            last_reviewed: '2026-05-21',
          },
        })}
      />,
    );

    expect(html).not.toContain('data-testid="source-posture-badge"');
  });
});
