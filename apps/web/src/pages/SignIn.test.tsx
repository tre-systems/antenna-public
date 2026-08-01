import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignIn } from './SignIn';

describe('SignIn', () => {
  it('renders a signed-out product preview and Google sign-in action', () => {
    const html = renderToString(<SignIn />);

    expect(html).toContain('Track the signals that matter.');
    expect(html).toContain('Monitor application health, usage, markets, and research');
    expect(html).toContain('data-testid="app-purpose"');
    expect(html).toContain('<h1');
    expect(html).toContain('Open-source project');
    expect(html).toContain('Daily signals');
    expect(html).toContain('Browser visits');
    expect(html).toContain('Built for your agents');
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
