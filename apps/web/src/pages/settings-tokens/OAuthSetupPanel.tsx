const mcpEndpoint = (): string => {
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://antenna.example';
  return `${origin}/api/mcp`;
};

export function OAuthSetupPanel() {
  const endpoint = mcpEndpoint();
  const command = `claude mcp add --transport http antenna ${endpoint}`;

  return (
    <section class="antenna-panel mb-6 rounded-2xl p-5">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Connect a new agent</h2>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Add the remote MCP server, then complete the browser sign-in. Antenna does not issue a token
        for you to copy or store.
      </p>
      <code
        class="mt-3 block overflow-x-auto whitespace-pre rounded-md bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
        data-testid="settings-connections-command"
      >
        {command}
      </code>
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Other OAuth-capable clients can use <span class="font-mono">{endpoint}</span> directly.
      </p>
    </section>
  );
}
