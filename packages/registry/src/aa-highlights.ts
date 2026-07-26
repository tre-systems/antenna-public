import { aaHighlights, type AaHighlightsConfig } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const aaHighlightsTemplate: ConnectorTemplate<AaHighlightsConfig> = {
  id: 'aa-highlights',
  displayName: 'Artificial Analysis highlights',
  configSchema: z
    .object({
      category: z.enum(['intelligence', 'speed', 'price']),
      limit: z.number().int().positive().max(10).optional(),
    })
    .strict(),
  paramKeys: ['category'] as const,
  matchHints: [
    /\bartificial\s+analysis\b/i,
    /\baa[-\s]+(?:intelligence|speed|price|highlights|leaderboard)\b/i,
    /\bmodel\s+intelligence\s+(?:index|leaderboard|ranking)\b/i,
    /\bllm\s+(?:speed|price|cost)\s*(?:comparison|leaderboard|ranking)?\b/i,
    /\bcheapest\s+(?:llm|ai\s+model|model)\b/i,
    /\bfastest\s+(?:llm|ai\s+model|model)\b/i,
    /\bai\s+model\s+(?:benchmark|comparison|ranking)\b/i,
  ],
  paramExtractors: {
    category: (prompt: string): string | undefined => {
      if (/speed|tokens?\s*(?:\/|per)\s*sec/i.test(prompt)) return 'speed';
      if (/price|cost|cheap/i.test(prompt)) return 'price';
      if (/intelligence|benchmark|index|ranking/i.test(prompt)) return 'intelligence';
      return undefined;
    },
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 3600,
  pointRetentionDays: 90,
  adapter: (config) => aaHighlights(config),
};
