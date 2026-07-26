import { cloudflareIncidents } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const cloudflareIncidentsTemplate: ConnectorTemplate = {
  id: 'cloudflare-incidents',
  displayName: 'Cloudflare incidents',
  configSchema: z.object({}),
  paramKeys: [] as const,
  matchHints: [
    /\bcloudflare\b.*\b(?:status|incidents?|outage|health|down|ok)\b/i,
    /\b(?:status|incidents?|outage|health|down|ok)\b.*\bcloudflare\b/i,
    /\bcf\b.*\b(?:status|incidents?|outage|health|down|ok)\b/i,
    /\b(?:status|incidents?|outage|health|down|ok)\b.*\bcf\b/i,
    /\bworkers?\b.*\b(?:status|incidents?|outage|down|ok)\b/i,
    /\b(?:d1|r2|workers?\s+kv)\b.*\b(?:status|incidents?|outage|down|ok)\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'public',
  defaultRefreshSeconds: 900,
  pointRetentionDays: 90,
  adapter: () => cloudflareIncidents({ lookbackHours: 24, limit: 3 }),
};
