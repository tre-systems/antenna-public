import { antennaUsers } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// Aggregate adoption counts only — no per-user rows. The Worker injects them from
// D1 at dispatch time, and only for a deployment admin's collection.

export const antennaUsersTemplate: ConnectorTemplate = {
  id: 'antenna-users',
  displayName: 'Antenna users',
  configSchema: z.object({
    total_users: z.number().optional(),
    new_users_24h: z.number().optional(),
    new_users_7d: z.number().optional(),
    active_users_7d: z.number().optional(),
    collections: z.number().optional(),
    signals: z.number().optional(),
  }),
  paramKeys: [] as const,
  matchHints: [
    /\bantenna\s+users?\b/i,
    /\b(?:sign[\s-]?ups?|signups)\b/i,
    /\bhow\s+many\s+(?:people|users)\b/i,
    /\bwho\s+(?:is|are)\s+using\b/i,
  ],
  paramExtractors: {},
  // Plannable by anyone; a non-admin who creates one gets setup_required at dispatch.
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 3_600,
  pointRetentionDays: 400,
  adapter: (config) => antennaUsers(config),
};
