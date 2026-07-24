import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AntennaReadClient } from './client.js';
import { jsonToolResult } from './factory-results.js';
import {
  confirmPlanTool,
  proposeSignalTool,
  refreshSignalTool,
  rejectPlanTool,
  removeSignalTool,
  reorderSignalsTool,
  updateSignalTool,
} from './tools.js';

export function registerWriteTools(server: McpServer, client: AntennaReadClient): void {
  server.registerTool(
    'refresh_signal',
    {
      title: 'Refresh collection signal',
      description:
        'Request a refresh for one signed-in user collection signal. The Worker records the request and the dispatcher fetches it on the next tick.',
      inputSchema: {
        signalId: z.string().min(1).describe('Collection signal id.'),
      },
    },
    async (input) => jsonToolResult(await refreshSignalTool(client, input)),
  );

  server.registerTool(
    'update_signal',
    {
      title: 'Update collection signal config',
      description:
        'Patch config, refresh cadence, and/or visibility for one signed-in user collection signal. The Worker owner-scopes the signal, validates the merged config against the registry schema, rejects shared/public visibility for source-policy-blocked templates, clamps refresh intervals, and clears stale points when config changes. Use only after showing the proposed edit to the user and receiving explicit approval.',
      inputSchema: {
        signalId: z.string().min(1).describe('Collection signal id.'),
        config: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Shallow config patch merged into the current signal config.'),
        refreshSeconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Optional refresh interval; the Worker clamps it to the supported range.'),
        visibility: z
          .enum(['private', 'shared', 'public'])
          .optional()
          .describe(
            'Optional signal visibility. Public visibility requires source-policy approval.',
          ),
      },
    },
    async (input) => jsonToolResult(await updateSignalTool(client, input)),
  );

  server.registerTool(
    'remove_signal',
    {
      title: 'Remove collection signal',
      description:
        'Delete one signed-in user collection signal. This is destructive: the Worker owner-scopes the signal, removes its points/status, and records starter dismissal where applicable. Use only after showing the exact signal title/id to the user and receiving explicit approval.',
      inputSchema: {
        signalId: z.string().min(1).describe('Collection signal id to delete.'),
      },
    },
    async (input) => jsonToolResult(await removeSignalTool(client, input)),
  );

  server.registerTool(
    'reorder_signals',
    {
      title: 'Reorder collection signals',
      description:
        'Reorder collection signals. Pass collectionId when targeting a non-primary collection; omit it only for the primary-collection compatibility route. The input must contain every current signal id exactly once. Use only after showing the full proposed order to the user and receiving explicit approval.',
      inputSchema: {
        collectionId: z
          .string()
          .min(1)
          .optional()
          .describe('Optional collection id returned by list_collections.'),
        orderedSignalIds: z
          .array(z.string().min(1))
          .min(1)
          .describe('All collection signal ids in the desired order.'),
      },
    },
    async (input) => jsonToolResult(await reorderSignalsTool(client, input)),
  );

  server.registerTool(
    'propose_signal',
    {
      title: 'Propose collection signal',
      description:
        'Submit a natural-language Ask Antenna prompt and return the proposed plan. This does not confirm or create signals.',
      inputSchema: {
        prompt: z.string().min(1).max(2000).describe('Natural-language collection request.'),
      },
    },
    async (input) => jsonToolResult(await proposeSignalTool(client, input)),
  );

  server.registerTool(
    'reject_plan',
    {
      title: 'Reject proposed plan',
      description:
        'Reject a pending Ask Antenna plan owned by the signed-in user. This does not delete signals or alter collection data.',
      inputSchema: {
        planId: z.string().min(1).describe('Pending collection plan id.'),
      },
    },
    async (input) => jsonToolResult(await rejectPlanTool(client, input)),
  );

  server.registerTool(
    'confirm_plan',
    {
      title: 'Confirm proposed plan',
      description:
        'Confirm a pending Ask Antenna plan owned by the signed-in user. Use only after showing the returned plan to the user and receiving explicit approval. Optional edits may fill missing config fields only; the Worker ignores client-submitted authority fields and revalidates against the registry.',
      inputSchema: {
        planId: z.string().min(1).describe('Pending collection plan id.'),
        editedSignals: z
          .array(z.object({ config: z.record(z.string(), z.unknown()).optional() }).strict())
          .optional()
          .describe(
            'Optional per-proposed config patches. Only missing config fields are applied by the Worker.',
          ),
      },
    },
    async (input) => jsonToolResult(await confirmPlanTool(client, input)),
  );
}
