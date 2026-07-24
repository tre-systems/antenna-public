// Render-only coverage; live connection flows use authenticated browser checks.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SettingsTokens } from './SettingsTokens';

describe('SettingsTokens', () => {
  it('renders OAuth setup and both connection lists', () => {
    const html = renderToString(<SettingsTokens />);
    expect(html).toContain('Agent access');
    expect(html).toContain('data-testid="settings-connections-command"');
    expect(html).toContain('claude mcp add --transport http antenna');
    expect(html).toContain('data-testid="settings-connections-loading"');
    expect(html).toContain('data-testid="settings-tokens-loading"');
  });

  it('does not offer manual token creation', () => {
    const html = renderToString(<SettingsTokens />);
    expect(html).not.toContain('Create token');
    expect(html).toContain('New manual tokens are disabled');
  });

  it('keeps a back link to the collection in the settings header', () => {
    const html = renderToString(<SettingsTokens />);
    expect(html).toContain('data-testid="settings-back-to-collection"');
  });
});
