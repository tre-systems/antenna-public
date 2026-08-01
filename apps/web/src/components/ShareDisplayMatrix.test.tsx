// Expand/collapse interaction remains e2e coverage.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { ShareDisplayMatrix } from './ShareDisplayMatrix';
import { signals as signalsState } from '../signals/signals';
import type { ApiSignal } from '../api';

const signal = (overrides: Partial<ApiSignal>): ApiSignal => ({
  id: 'b',
  template_id: 'fx-pair',
  visibility: 'private',
  config: {},
  refresh_seconds: 900,
  status: {
    status: 'live',
    last_ok_at: 0,
    last_attempt_at: 0,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [],
  display: { title: 'FX', source_label: 'Frankfurter', source_url: null },
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
  ...overrides,
});

beforeEach(() => {
  signalsState.value = null;
});

afterEach(() => {
  signalsState.value = null;
});

describe('ShareDisplayMatrix', () => {
  it('renders nothing when the collection is not shared', () => {
    signalsState.value = [signal({ id: 'a' })];
    expect(renderToString(<ShareDisplayMatrix visibility="private" />)).toBe('');
    expect(renderToString(<ShareDisplayMatrix visibility="public" />)).toBe('');
  });

  it('shows an all-clear summary when every signal is shared and policy allows', () => {
    signalsState.value = [
      signal({ id: 'a', visibility: 'shared' }),
      signal({ id: 'b', visibility: 'public' }),
    ];
    const html = renderToString(<ShareDisplayMatrix visibility="shared" />);
    expect(html).toContain('2 of 2');
    expect(html).toContain('visible on this link.');
    expect(html).not.toContain('data-testid="share-display-hidden-summary"');
  });

  it('counts private signals as hidden from the shared link', () => {
    signalsState.value = [signal({ id: 'a' }), signal({ id: 'b' })];
    const html = renderToString(<ShareDisplayMatrix visibility="shared" />);
    expect(html).toContain('0 of 2');
    expect(html).toContain('2 hidden');
    expect(html).toContain('data-testid="share-display-hidden-summary"');
    expect(html).toContain('2 not marked shared');
  });

  it('separates source-policy blockers from private signal visibility', () => {
    signalsState.value = [
      signal({ id: 'a', visibility: 'shared' }),
      signal({ id: 'b' }),
      signal({
        id: 'c',
        visibility: 'shared',
        source_policy: {
          source_id: 'yahoo-finance-chart',
          label: 'Yahoo Finance',
          source_url: 'https://finance.yahoo.com/',
          rights_status: 'with-attribution',
          execution_mode: 'public_cloud',
          public_display_eligible: false,
          public_display_blocker: 'Yahoo Finance - private dogfood stopgap.',
          attribution: 'Yahoo Finance',
          last_reviewed: '2026-05-21',
        },
      }),
    ];
    const html = renderToString(<ShareDisplayMatrix visibility="shared" />);
    expect(html).toContain('1 of 3');
    expect(html).toContain('2 hidden');
    expect(html).toContain('1 blocked by source policy');
    expect(html).toContain('1 not marked shared');
    expect(html).not.toContain('dogfood');
  });

  it('renders nothing when there are no signals yet', () => {
    signalsState.value = [];
    expect(renderToString(<ShareDisplayMatrix visibility="shared" />)).toBe('');
  });
});
