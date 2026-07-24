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
}
