import { fxFrankfurter } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

// Scan common pair phrasings while retaining the ISO three-letter shape.
const PAIR_SEPARATORS = /([A-Z]{3})\s*(?:\/|-|\bto\b|\bvs\.?\b|\bagainst\b|\bin\b)\s*([A-Z]{3})/i;

const extractPair = (prompt: string): { base: string; quote: string } | undefined => {
  const match = PAIR_SEPARATORS.exec(prompt);
  if (!match || !match[1] || !match[2]) return undefined;
  return { base: match[1].toUpperCase(), quote: match[2].toUpperCase() };
};

export const fxPairTemplate: ConnectorTemplate<{ base: string; quote: string }> = {
  id: 'fx-pair',
  displayName: 'FX pair',
  configSchema: z.object({
    base: z.string().regex(/^[A-Z]{3}$/),
    quote: z.string().regex(/^[A-Z]{3}$/),
  }),
  paramKeys: ['base', 'quote'] as const,
  matchHints: [
    /\bfx\b/i,
    /\bforex\b/i,
    /\bexchange\s+rate\b/i,
    /\bcurrency\b/i,
    /\b[A-Z]{3}\s*(?:\/|-|to|vs\.?|against)\s*[A-Z]{3}\b/i,
  ],
  paramExtractors: {
    base: (prompt) => extractPair(prompt)?.base,
    quote: (prompt) => extractPair(prompt)?.quote,
  },
  rightsStatus: 'public',
  defaultRefreshSeconds: 900,
  alertRules: [
    {
      id: 'large_move',
      label: 'FX moved more than 0.5%',
      condition: ({ latestValue, previousValue }) =>
        previousValue !== 0 && Math.abs(latestValue / previousValue - 1) > 0.005,
    },
  ],
  adapter: fxFrankfurter,
};
