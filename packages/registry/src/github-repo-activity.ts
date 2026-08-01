import { githubRepo } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// GitHub owner/repo captures accept its documented punctuation at token boundaries.
const REPO_RX = /(?:^|\s)([A-Za-z0-9][A-Za-z0-9._-]{0,38})\/([A-Za-z0-9._-]{1,100})(?=\s|$|[.,!?])/;

const matchRepo = (prompt: string): { owner: string; repo: string } | undefined => {
  const m = REPO_RX.exec(prompt);
  if (!m || !m[1] || !m[2]) return undefined;
  return { owner: m[1], repo: m[2] };
};

export const githubRepoActivityTemplate: ConnectorTemplate<{
  owner: string;
  repo: string;
  githubToken?: string;
}> = {
  id: 'github-repo-activity',
  displayName: 'GitHub repo activity',
  configSchema: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    githubToken: z.string().optional(),
  }),
  paramKeys: ['owner', 'repo'] as const,
  matchHints: [/\bgithub\b/i, /\brepo\b/i, /\bstars?\b/i, /\bissues?\b/i, /\bforks?\b/i],
  paramExtractors: {
    owner: (prompt) => matchRepo(prompt)?.owner,
    repo: (prompt) => matchRepo(prompt)?.repo,
  },
  rightsStatus: 'public',
  defaultRefreshSeconds: 1800,
  adapter: githubRepo,
};
