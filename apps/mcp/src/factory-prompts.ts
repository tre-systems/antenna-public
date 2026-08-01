import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'morning_brief',
    {
      title: 'Morning brief',
      description:
        'Summarise the current collection, flag stale/error signals, and highlight notable moves from chartable history.',
    },
    () => ({
      description: 'Create a concise morning brief from the signed-in Antenna collection.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Create a concise Antenna morning brief.',
              '',
              'Use list_collections first when collection choice is ambiguous, then call list_signals with collectionId for the selected collection. Group signals by status, call out stale or errored signals with last_error, and mention setup-needed sources if visible.',
              'For chartable market, crypto, macro, and FX signals, call get_signal_history with range "1y" when useful and report the broad direction and approximate percentage move.',
              'Keep it practical: source names, freshness, and links matter more than commentary. Do not invent missing data.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    'app_brief',
    {
      title: 'App brief',
      description:
        'Check production health, Worker errors, browser visits, and meaningful product actions across the app fleet.',
    },
    () => ({
      description:
        'Create an evidence-based app fleet brief from the signed-in Antenna collection.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Create a concise Antenna app brief.',
              '',
              'Use list_collections first when collection choice is ambiguous, then list_signals for the selected collection.',
              'Find app-health, cloudflare-analytics, cloudflare-web-analytics, project-portfolio, and app-usage signals. Report freshness and source status before interpreting values.',
              'Lead with down, degraded, or unconfigured health probes and any Worker errors. Then summarise real-browser visits and meaningful product actions, highlighting large changes.',
              'Treat traffic, browser visits, and product actions as different evidence. Call quiet telemetry quiet; call telemetry_state "unseen" an instrumentation gap, not zero usage.',
              'Worker requests include APIs, bots, health checks, development clients, and failed automation. When requests are high but browser visits and successful product actions are quiet or unseen, describe the mismatch as likely non-human or infrastructure traffic and recommend investigation; never report it as user growth.',
              'Include source links when available. Do not infer health from traffic and do not invent missing data.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
