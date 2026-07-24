import { boeUpcomingPublications } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const ukEconomicCalendarTemplate: ConnectorTemplate = {
  id: 'uk-economic-calendar',
  displayName: 'UK economic calendar',
  configSchema: z.object({}),
  paramKeys: [] as const,
  matchHints: [
    /\buk\b.*\b(?:economic|macro)\b.*\bcalendar\b/i,
    /\b(?:economic|macro)\b.*\bcalendar\b.*\buk\b/i,
    /\bbank of england\b.*\b(?:calendar|publications?|events?)\b/i,
    /\bboe\b.*\b(?:calendar|publications?|events?)\b/i,
    /\b(?:rate decision|monetary policy summary|monetary policy report|fpc record)\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'needs-review',
  defaultRefreshSeconds: 21_600,
  adapter: () => boeUpcomingPublications({ limit: 3 }),
};
