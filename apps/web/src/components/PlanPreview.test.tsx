import { afterEach, describe, expect, it, vi } from 'vitest';
import renderToString from 'preact-render-to-string';
import { PlanPreview } from './PlanPreview';
import { clearPlan, currentPlan } from '../signals/plan';
import type { PlanRecord, ProposedSignal } from '@antenna/shared';

function makePlan(
  signals: ProposedSignal[],
  unmatched: PlanRecord['plan']['unmatched'] = [],
): PlanRecord {
  return {
    id: 'p-1',
    collection_id: 'd-1',
    prompt: 'track CHF/USD',
    status: 'proposed',
    plan: { prompt: 'track CHF/USD', signals, unmatched },
    created_at: 0,
  };
}

const RESOLVED_BLOCK: ProposedSignal = {
  template_id: 'fx-pair',
  display_name: 'CHF/USD',
  config: { base: 'CHF', quote: 'USD' },
  missing: [],
  refresh_seconds: 60,
  rights_status: 'public',
  source_label: 'Frankfurter (ECB)',
};

const MISSING_BLOCK: ProposedSignal = {
  ...RESOLVED_BLOCK,
  display_name: 'FX pair',
  config: {},
  missing: ['base', 'quote'],
};

describe('PlanPreview', () => {
  afterEach(() => {
    clearPlan();
  });

  it('renders nothing when no plan is set', () => {
    clearPlan();
    const html = renderToString(<PlanPreview onConfirmed={vi.fn()} />);
    expect(html).toBe('');
  });

  function confirmButton(html: string): string {
    const match = /<button\b[^>]*data-testid="plan-preview-confirm"[^>]*>/.exec(html);
    if (match === null) throw new Error('confirm button not found');
    return match[0];
  }

  it('enables confirm when every signal has empty missing', () => {
    currentPlan.value = makePlan([RESOLVED_BLOCK]);
    const html = renderToString(<PlanPreview onConfirmed={vi.fn()} />);
    expect(html).toContain('data-testid="plan-preview-confirm"');
    // Preact emits a bare `disabled` attribute when the button is disabled;
    // Tailwind utilities like `disabled:opacity-50` are inside the class attr.
    expect(confirmButton(html)).not.toMatch(/\sdisabled(\s|>)/);
  });

  it('disables confirm when any signal has missing params', () => {
    currentPlan.value = makePlan([MISSING_BLOCK]);
    const html = renderToString(<PlanPreview onConfirmed={vi.fn()} />);
    expect(confirmButton(html)).toMatch(/\sdisabled(\s|>)/);
    expect(html).toContain('data-testid="plan-missing-base"');
    expect(html).toContain('data-testid="plan-missing-quote"');
  });

  it('renders unmatched hints as connector-request notes', () => {
    currentPlan.value = makePlan(
      [RESOLVED_BLOCK],
      [{ fragment: 'whisky futures', blocker_reason: 'unsupported_source' }],
    );
    const html = renderToString(<PlanPreview onConfirmed={vi.fn()} />);
    expect(html).toContain("We couldn't connect");
    expect(html).toContain('whisky futures');
    expect(html).toContain('No reviewed connector is available');
  });

  it('humanises the rights-status pill instead of showing the raw enum', () => {
    currentPlan.value = makePlan([
      { ...RESOLVED_BLOCK, rights_status: 'public' },
      { ...RESOLVED_BLOCK, rights_status: 'with-attribution' },
      { ...RESOLVED_BLOCK, rights_status: 'requires-auth' },
    ]);
    const html = renderToString(<PlanPreview onConfirmed={vi.fn()} />);
    expect(html).toContain('Public source');
    expect(html).toContain('Public · attribution');
    expect(html).toContain('Requires sign-in');
    // Dev-enum values should still appear as data-rights for testability /
    // future styling, but never as the visible label.
    expect(html).toContain('data-rights="public"');
    expect(html).toContain('data-rights="with-attribution"');
    expect(html).toContain('data-rights="requires-auth"');
  });
});
