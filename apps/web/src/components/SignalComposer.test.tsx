// Render via preact-render-to-string. Signals updated synchronously before render.
import { afterEach, describe, expect, it, vi } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalComposer } from './SignalComposer';
import { clearPlan, connectorRequests, currentPlan } from '../signals/plan';
import type { PlanRecord } from '@antenna/shared';

const PLAN: PlanRecord = {
  id: 'p-1',
  collection_id: 'd-1',
  prompt: 'track CHF/USD',
  status: 'proposed',
  plan: {
    prompt: 'track CHF/USD',
    signals: [
      {
        template_id: 'fx-pair',
        display_name: 'CHF/USD',
        config: { base: 'CHF', quote: 'USD' },
        missing: [],
        refresh_seconds: 60,
        rights_status: 'public',
        source_label: 'Frankfurter (ECB)',
      },
    ],
    unmatched: [],
  },
  created_at: 0,
};

describe('SignalComposer', () => {
  afterEach(() => {
    clearPlan();
    connectorRequests.value = [];
  });

  it('renders nothing until the composer is opened', () => {
    clearPlan();
    const html = renderComposer({ open: false });
    expect(html).not.toContain('Track something');
    expect(html).not.toContain('data-testid="signal-composer-input"');
    expect(html).not.toContain('data-testid="plan-preview"');
  });

  it('opens with agent creation first and a collapsed browser fallback', () => {
    clearPlan();
    const html = renderComposer({ open: true, autoFocus: true });
    expect(html).toContain('Track something');
    expect(html).toContain('Add it with your agent');
    expect(html).toContain('Ask Codex or another connected agent');
    expect(html).toContain('data-testid="track-something-browser-fallback"');
    expect(html).not.toContain('data-testid="signal-composer-input"');
    expect(html).not.toContain('data-testid="signal-composer-submit"');
    expect(html).not.toContain('data-testid="track-something-browse-sources"');
    expect(html).not.toContain('collection template');
    expect(html).not.toContain('data-testid="plan-preview"');
  });

  it('does not put arbitrary examples or a planning prompt on the start screen', () => {
    clearPlan();
    const html = renderComposer({ open: true, autoFocus: true });
    expect(html).not.toContain('What should Antenna track?');
    expect(html).not.toContain('Paris weather');
    expect(html).not.toContain('&gt;Plan&lt;');
  });

  it('keeps unresolved setup requests out of the agent-first start view', () => {
    connectorRequests.value = [
      {
        id: 'request-1',
        prompt: 'US treasury auctions',
        fragment: 'US treasury auctions',
        count: 1,
        created_at: 0,
        updated_at: 0,
      },
    ];

    const html = renderComposer({ open: true });
    expect(html).not.toContain('Requests waiting on support');
    expect(html).not.toContain('US treasury auctions');
  });

  it('renders the PlanPreview when a plan is in the signal', () => {
    currentPlan.value = PLAN;
    const html = renderComposer({ open: false });
    expect(html).toContain('data-testid="plan-preview"');
    expect(html).toContain('CHF/USD');
    expect(html).toContain('track CHF/USD');
  });
});

function renderComposer(props: { readonly open: boolean; readonly autoFocus?: boolean }) {
  return renderToString(
    <SignalComposer
      open={props.open}
      onConfirmed={vi.fn()}
      onOpenChange={vi.fn()}
      autoFocus={props.autoFocus}
    />,
  );
}
