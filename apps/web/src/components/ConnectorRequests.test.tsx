// preact-render-to-string is synchronous and does not execute effects,
// so we drive state through the signal directly.
import { afterEach, describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { ConnectorRequests } from './ConnectorRequests';
import { connectorRequests } from '../signals/plan';
import type { ConnectorRequestRecord } from '@antenna/shared';

const SAMPLE: ConnectorRequestRecord[] = [
  {
    id: 'r1',
    prompt: 'whisky futures',
    fragment: 'whisky futures',
    count: 3,
    created_at: 0,
    updated_at: 0,
  },
  {
    id: 'r2',
    prompt: 'Mongolian wool spot',
    fragment: 'Mongolian wool spot',
    source_label: 'Trading Economics',
    source_url: 'https://tradingeconomics.com/',
    candidate_template_id: 'trading-economics-market',
    setup_hint: 'Needs a Trading Economics API key.',
    rights_status: 'needs-review',
    blocker_reason: 'source_rights_blocked',
    count: 1,
    created_at: 0,
    updated_at: 0,
  },
];

describe('ConnectorRequests', () => {
  afterEach(() => {
    connectorRequests.value = [];
  });

  it('renders nothing when there are no requests', () => {
    connectorRequests.value = [];
    const html = renderToString(<ConnectorRequests />);
    expect(html).toBe('');
  });

  it('renders each fragment with its count when populated', () => {
    connectorRequests.value = SAMPLE;
    const html = renderToString(<ConnectorRequests />);
    expect(html).toContain('data-testid="connector-requests"');
    expect(html).toContain('Diagnostics');
    expect(html).toContain('2 setup requests');
    expect(html).toContain('whisky futures');
    expect(html).toContain('×3');
    expect(html).toContain('Trading Economics');
    expect(html).toContain('Source review');
    expect(html).toContain('trading-economics-market');
    expect(html).toContain('needs-review');
    expect(html).toContain('href="https://tradingeconomics.com/"');
    expect(html).toContain('Needs a Trading Economics API key.');
    expect(html).toContain('×1');
  });
});
