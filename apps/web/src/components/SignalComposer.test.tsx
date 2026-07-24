// Render via preact-render-to-string. Signals updated synchronously before render.
import { afterEach, describe, expect, it, vi } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalComposer } from './SignalComposer';
import { clearPlan, currentPlan } from '../signals/plan';
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
  });

  it('renders nothing until the composer is opened', () => {
    clearPlan();
    const html = renderComposer({ open: false });
    expect(html).not.toContain('Add signal');
    expect(html).not.toContain('data-testid="signal-composer-input"');
    expect(html).not.toContain('data-testid="plan-preview"');
  });

  it('renders the input and submit button when focused from onboarding', () => {
    clearPlan();
    const html = renderComposer({ open: true, autoFocus: true });
    expect(html).toContain('Add signal');
    expect(html).toContain('data-testid="signal-composer-input"');
    expect(html).toContain('data-testid="signal-composer-submit"');
    expect(html).not.toContain('data-testid="plan-preview"');
  });

  it('renders the example prompts as clickable buttons (not inert code chips)', () => {
    clearPlan();
    const html = renderComposer({ open: true, autoFocus: true });
    // Each example renders as a button with a data-testid we can target
    // for click-driven e2e tests later.
    expect(html).toContain('data-testid="signal-composer-example-track-CHF-USD"');
    expect(html).toContain('data-testid="signal-composer-example-weather-in-Paris"');
    expect(html).toContain('data-testid="signal-composer-example-github-vercel-next-js"');
    expect(html).toContain('CHF/USD');
    expect(html).toContain('Paris weather');
    expect(html).toContain('vercel/next.js');
    expect(html).not.toContain('example-org/antenna');
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
