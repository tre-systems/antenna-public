import { cisaKevRecent } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const cisaKevRecentTemplate: ConnectorTemplate = {
  id: 'cisa-kev-recent',
  displayName: 'CISA KEV recent additions',
  configSchema: z.object({}),
  paramKeys: [] as const,
  matchHints: [
    /\bcisa\b.*\bkev\b/i,
    /\bkev\b/i,
    /\bcve(?:s)?\b/i,
    /\bknown exploited vulnerabilities\b/i,
    /\bactively exploited\b/i,
    /\bexploited vulnerabilities\b/i,
    /\bsecurity\b.*\bvulnerabilit(?:y|ies)\b/i,
    /\bvulnerabilit(?:y|ies)\b.*\bsecurity\b/i,
    /\bsecurity\b.*\bon fire\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'public',
  defaultRefreshSeconds: 3600,
  pointRetentionDays: 90,
  adapter: () => cisaKevRecent({ lookbackDays: 7, limit: 3 }),
};
