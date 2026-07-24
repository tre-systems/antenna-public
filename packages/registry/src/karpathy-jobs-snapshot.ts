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
  // Daily. The underlying BLS dataset is annual, but a daily tick keeps the
  // card responsive to connector/registry/UI changes (a fresh emission of
  // top_role points or a redesigned hero would otherwise wait up to a week
  // before showing on the live signal).
  defaultRefreshSeconds: 86_400,
  adapter: () => karpathyJobs({}),
};
