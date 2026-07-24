import { macroMarketHistory, type MacroMarketHistoryConfig } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

export type MacroPresetId = 'uk-10y-gilt' | 'gbp-usd' | 'gold' | 'crude-oil';

type MacroPreset = {
  readonly id: MacroPresetId;
  readonly config: MacroMarketHistoryConfig;
  readonly aliases: readonly RegExp[];
};

export const MACRO_MARKET_PRESETS: readonly MacroPreset[] = [
  {
    id: 'uk-10y-gilt',
    config: {
      kind: 'boe-series',
      series: 'IUDMNPY',
      label: 'UK 10Y gilt',
      unit: '%',
      sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
    },
    aliases: [
      /\buk\s+10y\b/i,
      /\b10[-\s]?year\s+(?:gilt|bond|yield)\b/i,
      /\b(?:gilt|government\s+bond)\s+yield\b/i,
    ],
  },
  {
    id: 'gbp-usd',
    config: {
      kind: 'frankfurter-pair',
      base: 'GBP',
      quote: 'USD',
      label: 'GBP/USD',
      unit: 'USD',
      sourceUrl: 'https://frankfurter.dev/',
    },
    aliases: [/\bgbp\s*\/?\s*usd\b/i, /\bsterling\b/i, /\bpound\s+dollar\b/i],
  },
  {
    id: 'gold',
    config: {
      kind: 'yahoo-symbol',
      symbol: 'GC=F',
      label: 'Gold',
      unit: 'USD',
      sourceUrl: 'https://finance.yahoo.com/quote/GC=F/',
    },
    aliases: [/\bgold\b/i, /\bxau\b/i],
  },
  {
    id: 'crude-oil',
    config: {
      kind: 'eia-petroleum-html',
      symbol: 'RWTC',
      label: 'Crude oil',
      unit: 'USD/BBL',
      sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
    },
    aliases: [/\bcrude\s+oil\b/i, /\bwti\b/i, /\boil\b/i],
  },
] as const;

const findPreset = (prompt: string): MacroPreset | undefined =>
  MACRO_MARKET_PRESETS.find((preset) => preset.aliases.some((alias) => alias.test(prompt)));

const presetConfig = (presetId: string | undefined): MacroMarketHistoryConfig | undefined =>
  MACRO_MARKET_PRESETS.find((preset) => preset.id === presetId)?.config;

export const macroMarketHistoryTemplate: ConnectorTemplate<{ preset: string }> = {
  id: 'macro-market-history',
  displayName: 'Macro market history',
  configSchema: z.object({
    preset: z.enum(['uk-10y-gilt', 'gbp-usd', 'gold', 'crude-oil']),
  }),
  paramKeys: ['preset'] as const,
  matchHints: [
    /\b(?:uk\s+10y|gilt|government\s+bond|gbp\s*\/?\s*usd|sterling|gold|crude\s+oil|wti)\b/i,
    /\b(?:uk\s+10y|gilt|government\s+bond|gbp\s*\/?\s*usd|sterling|gold|crude\s+oil|wti)\b.*\b(?:chart|graph|history|historical|yearly|one[-\s]?year|1y)\b|\b(?:chart|graph|history|historical|yearly|one[-\s]?year|1y)\b.*\b(?:uk\s+10y|gilt|government\s+bond|gbp\s*\/?\s*usd|sterling|gold|crude\s+oil|wti)\b/i,
    /\b(?:macro|market\s+pulse|rates|currency|commodit(?:y|ies))\b/i,
  ],
  paramExtractors: {
    preset: (prompt) => findPreset(prompt)?.id,
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  pointRetentionDays: 400,
  adapter: (config) => {
    const preset = presetConfig(config.preset);
    if (!preset) {
      return Promise.resolve({
        ok: false,
        error: {
          code: 'parse_failed',
          message: `unknown macro-market-history preset: ${config.preset}`,
        },
      });
    }
    return macroMarketHistory({ ...preset, days: 365 });
  },
};
