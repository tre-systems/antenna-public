import { githubSecurityAdvisories } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export const githubSecurityAdvisoriesTemplate: ConnectorTemplate = {
  id: 'github-security-advisories',
  displayName: 'GitHub Security Advisories',
  configSchema: z.object({
    githubToken: z.string().optional(),
  }),
  paramKeys: [] as const,
  matchHints: [
    /\bgithub\b.*\bsecurity\b.*\badvisories\b/i,
    /\bsecurity\b.*\badvisories\b.*\bgithub\b/i,
    /\bnpm\b.*\b(?:security|advisories|vulnerabilities|vulns?|cves?)\b/i,
    /\b(?:security|advisories|vulnerabilities|vulns?|cves?)\b.*\bnpm\b/i,
    /\bhigh\s+severity\b.*\bnpm\b/i,
    /\bhigh\b.*\bcritical\b.*\badvisories\b/i,
    /\bsupply[-\s]?chain\b.*\b(?:npm|security)\b/i,
  ],
  paramExtractors: {},
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  pointRetentionDays: 90,
  adapter: (config) =>
    githubSecurityAdvisories({
      ecosystem: 'npm',
      limit: 3,
      githubToken:
        typeof config.githubToken === 'string' && config.githubToken.trim().length > 0
          ? config.githubToken
          : undefined,
    }),
};
