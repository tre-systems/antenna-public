import { SettingsShell } from '../components/SettingsShell';
import { ConnectionList } from './settings-tokens/ConnectionList';
import { OAuthSetupPanel } from './settings-tokens/OAuthSetupPanel';
import { TokenList } from './settings-tokens/TokenList';
import { useMcpConnections } from './settings-tokens/use-mcp-connections';
import { useMcpTokens } from './settings-tokens/use-mcp-tokens';

export function SettingsTokens() {
  const tokens = useMcpTokens();
  const connections = useMcpConnections();

  return (
    <SettingsShell
      title="Agent access"
      description="Connect agents and MCP clients with OAuth. Each connection has full owner-scoped access to your Antenna account, so disconnect anything you no longer recognise or use."
    >
      <OAuthSetupPanel />

      <section class="mb-6" data-testid="settings-connections-list-section">
        <h2 class="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Connected agents</h2>
        <ConnectionList
          state={connections.list}
          disconnecting={connections.disconnecting}
          onDisconnect={(clientId) => void connections.disconnect(clientId)}
        />
      </section>

      <section data-testid="settings-tokens-list-section">
        <h2 class="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          Legacy manual tokens
        </h2>
        <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
          New manual tokens are disabled. Any older token shown here remains usable until revoked.
        </p>
        <TokenList
          state={tokens.list}
          revoking={tokens.revoking}
          onRevoke={(id) => {
            void tokens.revokeToken(id);
          }}
        />
      </section>
    </SettingsShell>
  );
}
