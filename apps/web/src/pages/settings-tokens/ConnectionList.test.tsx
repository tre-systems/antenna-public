import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { ConnectionList } from './ConnectionList';

describe('ConnectionList', () => {
  it('renders empty and error states', () => {
    const empty = renderToString(
      <ConnectionList
        state={{ kind: 'ready', connections: [] }}
        disconnecting={null}
        onDisconnect={() => undefined}
      />,
    );
    const error = renderToString(
      <ConnectionList
        state={{ kind: 'error', message: 'Network unavailable' }}
        disconnecting={null}
        onDisconnect={() => undefined}
      />,
    );

    expect(empty).toContain('No agents are connected with OAuth');
    expect(error).toContain("Couldn't load connections");
    expect(error).toContain('Network unavailable');
    expect(error).toContain('role="alert"');
  });

  it('renders a live connection and disabled disconnect state', () => {
    const html = renderToString(
      <ConnectionList
        state={{
          kind: 'ready',
          connections: [
            {
              client_id: 'client-1',
              name: 'Claude Code',
              created_at: Date.now() - 60_000,
              last_refreshed_at: Date.now() - 30_000,
              access_expires_at: Date.now() + 60_000,
              refresh_expires_at: Date.now() + 120_000,
              scopes: ['offline_access'],
            },
          ],
        }}
        disconnecting="client-1"
        onDisconnect={() => undefined}
      />,
    );

    expect(html).toContain('Claude Code');
    expect(html).toContain('Disconnecting...');
    expect(html).toContain('disabled');
    expect(html).not.toContain('access-');
    expect(html).not.toContain('refresh-');
  });
});
