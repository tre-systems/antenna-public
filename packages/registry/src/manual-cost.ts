import { manualCost, type ManualCostConfig } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

const PROVIDERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bcloudflare\b/i, 'Cloudflare'],
  [/\b(?:amazon web services|aws)\b/i, 'AWS'],
  [/\b(?:google cloud|gcp|gemini)\b/i, 'Google Cloud'],
  [/\bmodal\b/i, 'Modal'],
  [/\bgroq\b/i, 'Groq'],
  [/\bsentry\b/i, 'Sentry'],
  [/\bresend\b/i, 'Resend'],
  [/\bopenai\b/i, 'OpenAI'],
  [/\b(?:anthropic|claude)\b/i, 'Anthropic'],
  [/\bgithub\b/i, 'GitHub'],
];

const amountFromPrompt = (prompt: string): string | undefined => {
  const symbolAmount = /[£$€]\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/.exec(prompt)?.[1];
  const codeAmount = /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:GBP|USD|EUR)\b/i.exec(prompt)?.[1];
  return (symbolAmount ?? codeAmount)?.replaceAll(',', '');
};

const currencyFromPrompt = (prompt: string): string | undefined => {
  if (/£|\bGBP\b/i.test(prompt)) return 'GBP';
  if (/\$|\bUSD\b/i.test(prompt)) return 'USD';
  if (/€|\bEUR\b/i.test(prompt)) return 'EUR';
  return undefined;
};

const periodFromPrompt = (prompt: string): string => {
  if (/\b(?:today|daily|day)\b/i.test(prompt)) return 'today';
  if (/\blast\s+month\b/i.test(prompt)) return 'last_month';
  if (/\b(?:monthly|recurring)\b/i.test(prompt)) return 'monthly';
  return 'month_to_date';
};

const providerFromPrompt = (prompt: string): string | undefined =>
  PROVIDERS.find(([pattern]) => pattern.test(prompt))?.[1];

export const manualCostTemplate: ConnectorTemplate<ManualCostConfig> = {
  id: 'manual-cost',
  displayName: 'Manual cost',
  configSchema: z.object({
    amount: z.union([z.literal(''), z.coerce.number().nonnegative()]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    period: z.enum(['today', 'month_to_date', 'last_month', 'monthly']),
    provider: z.string().trim().min(1).max(80),
    service: z.string().trim().min(1).max(120).default('All services'),
    project: z.string().trim().min(1).max(120).optional(),
  }),
  paramKeys: ['provider', 'amount', 'currency', 'period'] as const,
  matchHints: [
    /\b(?:cost|costs|spend|spending|bill|billing)\b/i,
    /\b(?:manual|record|track)\b.*\b(?:cost|spend|bill)\b/i,
  ],
  paramExtractors: {
    amount: amountFromPrompt,
    currency: currencyFromPrompt,
    period: periodFromPrompt,
    provider: providerFromPrompt,
  },
  rightsStatus: 'requires-auth',
  defaultRefreshSeconds: 86_400,
  pointRetentionDays: 400,
  adapter: manualCost,
};
