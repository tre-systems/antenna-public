import { karpathyJobs } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const karpathyJobsSnapshotTemplate: ConnectorTemplate = {
  id: 'karpathy-jobs-snapshot',
  displayName: 'Karpathy jobs snapshot',
  configSchema: z.object({}),
  paramKeys: [] as const,
  matchHints: [
    /\bkarpathy\b.*\bjobs?\b/i,
    /\bjobs?\b.*\bkarpathy\b/i,
    /\bkarpathy\b.*\b(?:hiring|careers?|roles?)\b/i,
    /\b(?:hiring|careers?|roles?)\b.*\bkarpathy\b/i,
    /\bai\b.*\bjobs?\b.*\bexposure\b/i,
    /\bjob\s+market\s+visuali[sz]er\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  // The BLS dataset is annual; a daily tick only keeps the card responsive to
  // connector and UI changes.
  defaultRefreshSeconds: 86_400,
  adapter: () => karpathyJobs({}),
};
