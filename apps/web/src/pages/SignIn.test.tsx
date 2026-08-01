import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignIn } from './SignIn';

describe('SignIn', () => {
  it('renders a signed-out product preview and Google sign-in action', () => {
    const html = renderToString(<SignIn />);

    expect(html).toContain('Track the signals that matter.');
    expect(html).toContain('Collects live market, operations, and research signals');
    expect(html).toContain('data-testid="app-purpose"');
    expect(html).toContain('<h1');
    expect(html).toContain('Open-source project');
    expect(html).toContain('Morning briefing');
    expect(html).toContain('BTC/USD');
    expect(html).toContain('Agent proposal');
    expect(html).toContain('MCP agents');
    expect(html).toContain('Continue with Google');
    expect(html).not.toContain('dogfood');
    expect(html).not.toContain("Rob's");
  });

  it('does not link to public discovery', () => {
    const html = renderToString(<SignIn />);

    expect(html).not.toContain('href="/public"');
    expect(html).not.toContain('Browse public collections');
  });
});
