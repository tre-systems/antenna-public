import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignIn } from './SignIn';

describe('SignIn', () => {
  it('renders a signed-out product preview and Google sign-in action', () => {
    const html = renderToString(<SignIn />);

    expect(html).toContain('Track the signals that matter.');
    expect(html).toContain('Market pulse');
    expect(html).toContain('Add signal');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('src="/favicon.svg"');
    expect(html).not.toContain('internal-only');
  });

  it('does not link to public discovery', () => {
    const html = renderToString(<SignIn />);

    expect(html).not.toContain('href="/public"');
    expect(html).not.toContain('Browse public collections');
  });
});
