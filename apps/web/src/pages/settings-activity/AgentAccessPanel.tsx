export function AgentAccessPanel() {
  return (
    <section class="rounded-2xl bg-white/70 p-5 text-sm ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Agent access</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Connect Claude and other MCP clients to your collections. They use the same owner-scoped API
        boundaries as this app — most sign in with OAuth, with per-device tokens for clients that
        can't.
      </p>
      <a
        href="/settings/tokens"
        class="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:bg-white dark:text-slate-900"
        data-testid="activity-mcp-link"
      >
        Manage agent access
      </a>
    </section>
  );
}
