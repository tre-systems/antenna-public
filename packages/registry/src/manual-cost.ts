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
  for (const match of prompt.matchAll(/[0-9][0-9,.]*/g)) {
    const raw = match[0];
    const start = match.index;
    const before = prompt.slice(0, start).trimEnd().at(-1);
    const after = prompt.slice(start + raw.length);
    if (!isCurrencySymbol(before) && !startsWithCurrencyCode(after)) continue;
    const amount = normaliseAmount(raw);
    if (amount !== undefined) return amount;
  }
  return undefined;
};

const isCurrencySymbol = (value: string | undefined): boolean =>
  value === '£' || value === '$' || value === '€';

const startsWithCurrencyCode = (value: string): boolean => {
  const trimmed = value.trimStart();
  const code = trimmed.slice(0, 3).toUpperCase();
  if (code !== 'GBP' && code !== 'USD' && code !== 'EUR') return false;
  const boundary = trimmed[3];
  return boundary === undefined || !/[A-Za-z]/.test(boundary);
};

const normaliseAmount = (raw: string): string | undefined => {
  const withoutCommas = raw.replaceAll(',', '');
  const parts = withoutCommas.split('.');
  if (parts.length > 2) return undefined;
  const [integer, decimal] = parts;
  if (!integer || !/^\d+$/.test(integer)) return undefined;
  if (decimal !== undefined && !/^\d{1,2}$/.test(decimal)) return undefined;
  return decimal === undefined ? integer : `${integer}.${decimal}`;
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
