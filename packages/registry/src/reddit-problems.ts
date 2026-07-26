import { redditProblems } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

const configSchema = z.object({
  subreddits: z.array(z.string().min(1)).min(1).max(10).optional(),
  lookbackHours: z.number().int().positive().max(168).optional(),
  limit: z.number().int().positive().max(25).optional(),
  minBodyChars: z.number().int().positive().max(2000).optional(),
});

const SUBREDDIT_PATTERN = /\br\/([a-z0-9_]{2,21})\b/i;

export const redditProblemsTemplate: ConnectorTemplate = {
  id: 'reddit-problems',
  displayName: 'Reddit problem candidates',
  configSchema,
  paramKeys: ['subreddits'] as const,
  matchHints: [
    /\breddit\b.*\bproblem/i,
    /\bproblem/i,
    /\bpain ?points?\b/i,
    /\bunmet needs?\b/i,
    /\br\/[a-z0-9_]{2,21}\b/i,
    /\bwhat are people (?:complaining|asking) about\b/i,
  ],
  paramExtractors: {
    subreddits: (prompt: string) => SUBREDDIT_PATTERN.exec(prompt)?.[1],
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  pointRetentionDays: 90,
  retainRawPayload: true,
  adapter: redditProblems,
};
