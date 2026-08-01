import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { DemoDashboard } from './DemoDashboard';

describe('DemoDashboard', () => {
  it('renders fictional demo signals without personal collection data', () => {
    const html = renderToString(<DemoDashboard />);

    expect(html).toContain('data-testid="sign-in-demo-dashboard"');
    expect(html).toContain('Morning briefing');
    expect(html).toContain('BTC/USD');
    expect(html).toContain('GitHub Trending');
    expect(html).toContain('Agent proposal');
    expect(html).toContain('Approval required');
    expect(html).not.toContain("Rob's");
    expect(html).not.toContain('BA.L');
    expect(html).not.toContain('Monday morning cockpit');
  });
});
