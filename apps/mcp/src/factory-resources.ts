import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AntennaReadClient } from './client.js';
import { stringVariable } from './factory-results.js';
import { getSignalTool, listSignalsTool } from './tools.js';

export function registerResources(server: McpServer, client: AntennaReadClient): void {
  server.registerResource(
    'current_collection',
    'collection://current',
    {
      title: 'Current collection',
      description:
        'Current signed-in Antenna collection snapshot, formatted for quick agent summarisation.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const signals = await listSignalsTool(client);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({ generated_at: new Date().toISOString(), signals }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'signal_detail',
    new ResourceTemplate('signals://{signal_id}', { list: undefined }),
    {
      title: 'Collection signal',
      description: 'Single collection signal detail, including source, status, config, and points.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const signalId = stringVariable(variables.signal_id);
      const signal = signalId ? await getSignalTool(client, { signalId }) : null;
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              signal ?? { error: 'not_found', signal_id: signalId ?? null },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
