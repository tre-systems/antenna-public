import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AntennaClient } from './client.js';
import { jsonToolResult } from './factory-results.js';
import {
  getSignalHistoryTool,
  getSignalTool,
  getCollectionTool,
  listSignalsTool,
  listConnectorRequestsTool,
  listCollectionsTool,
  listTemplatesTool,
} from './tools.js';

export function registerReadTools(server: McpServer, client: AntennaClient): void {
  server.registerTool(
    'list_collections',
    {
      title: 'List collections',
      description:
        'List the signed-in user collections with ids, titles, visibility, update time, and signal counts. Use these ids when a later tool needs an explicit collection target.',
    },
    async () => jsonToolResult(await listCollectionsTool(client)),
  );

  server.registerTool(
    'get_collection',
    {
      title: 'Get collection',
      description:
        'Return one signed-in user collection by id, including collection metadata and ordered signal summaries.',
      inputSchema: {
        collectionId: z.string().min(1).describe('Collection id returned by list_collections.'),
      },
    },
    async (input) => jsonToolResult(await getCollectionTool(client, input)),
  );

  server.registerTool(
    'list_signals',
    {
      title: 'List collection signals',
      description:
        'List signed-in user collection signals, including status, source, latest point, and source policy metadata. Pass collectionId from list_collections when the target collection is known.',
      inputSchema: {
        collectionId: z
          .string()
          .min(1)
          .optional()
          .describe('Optional collection id returned by list_collections.'),
        status: z
          .enum(['live', 'stale', 'error', 'loading'])
          .optional()
          .describe('Optional exact signal status filter.'),
        templateId: z.string().optional().describe('Optional template id filter.'),
      },
    },
    async (input) => jsonToolResult(await listSignalsTool(client, input)),
  );

  server.registerTool(
    'get_signal_history',
    {
      title: 'Get signal history',
      description: 'Return historical data points for a chartable collection signal.',
      inputSchema: {
        signalId: z.string().min(1).describe('Collection signal id.'),
        range: z
          .enum(['1m', '3m', '6m', '1y', 'all'])
          .optional()
          .describe('History range, defaulting to 1y.'),
      },
    },
    async (input) => jsonToolResult(await getSignalHistoryTool(client, input)),
  );

  server.registerTool(
    'get_signal',
    {
      title: 'Get collection signal',
      description:
        'Return one signed-in user collection signal, including status, source, config, and latest raw points.',
      inputSchema: {
        signalId: z.string().min(1).describe('Collection signal id.'),
      },
    },
    async (input) => jsonToolResult(await getSignalTool(client, input)),
  );

  server.registerTool(
    'list_connector_requests',
    {
      title: 'List connector requests',
      description:
        'List unmatched source requests captured by Ask Antenna, including setup hints and rights posture when available.',
    },
    async () => jsonToolResult(await listConnectorRequestsTool(client)),
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List templates',
      description:
        'List server-owned connector templates, including required params, setup state, rights status, and source policy metadata.',
    },
    async () => jsonToolResult(await listTemplatesTool(client)),
  );
}
