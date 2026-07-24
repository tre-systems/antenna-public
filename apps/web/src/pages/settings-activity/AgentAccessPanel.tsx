export function AgentAccessPanel() {
  return (
    <section class="antenna-panel rounded-2xl p-5 text-sm">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Agent access</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Connect Claude and other MCP clients to your collections. They use the same owner-scoped API
        boundaries as this app — most sign in with OAuth, with per-device tokens for clients that
        can't.
      </p>
      <a
        href="/settings/tokens"
        class="antenna-primary mt-3 inline-flex rounded-md px-3 py-1.5 text-xs font-semibold transition"
        data-testid="activity-mcp-link"
      >
        Manage agent access
      </a>
    </section>
  );
}
