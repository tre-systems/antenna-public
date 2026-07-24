import { tradingEconomicsMarket } from '@antenna/connectors';
import { z } from 'zod';
import { type ConnectorTemplate } from './types';

type MacroSeries = {
  readonly symbol: string;
  readonly label: string;
  readonly unit: string;
  readonly sourceUrl: string;
  readonly aliases: readonly RegExp[];
};

const SERIES: readonly MacroSeries[] = [
  {
    symbol: 'GUKG10:IND',
    label: 'UK 10Y gilt',
    unit: '%',
    sourceUrl: 'https://tradingeconomics.com/united-kingdom/government-bond-yield',
    aliases: [
      /\buk\s+10y\b/i,
      /\b10[-\s]?year\s+(?:gilt|bond|yield)\b/i,
      /\b(?:gilt|government\s+bond)\s+yield\b/i,
    ],
  },
  {
    symbol: 'GBPUSD:CUR',
    label: 'GBP/USD',
    unit: 'USD',
    sourceUrl: 'https://tradingeconomics.com/gbpusd:cur',
    aliases: [/\bgbp\s*\/?\s*usd\b/i, /\bsterling\b/i, /\bpound\s+dollar\b/i],
  },
  {
    symbol: 'XAUUSD:CUR',
    label: 'Gold',
    unit: 'USD/t.oz',
    sourceUrl: 'https://tradingeconomics.com/commodity/gold',
    aliases: [/\bgold\b/i, /\bxauusd\b/i],
  },
  {
    symbol: 'CL1:COM',
    label: 'Crude oil',
    unit: 'USD/BBL',
    sourceUrl: 'https://tradingeconomics.com/commodity/crude-oil',
    aliases: [/\bcrude\s+oil\b/i, /\bwti\b/i, /\boil\b/i],
  },
];

const SYMBOL_RX = /\b([A-Z0-9]{2,16}:(?:CUR|COM|IND|US))\b/i;

const findSeries = (prompt: string): MacroSeries | undefined =>
  SERIES.find((series) => series.aliases.some((alias) => alias.test(prompt)));

const extractSymbol = (prompt: string): string | undefined => {
  const known = findSeries(prompt);
  if (known) return known.symbol;
  return SYMBOL_RX.exec(prompt)?.[1]?.toUpperCase();
};

const extractLabel = (prompt: string): string | undefined => {
  const known = findSeries(prompt);
  if (known) return known.label;
  return extractSymbol(prompt);
};

const extractUnit = (prompt: string): string | undefined => findSeries(prompt)?.unit ?? '';

const extractSourceUrl = (prompt: string): string | undefined => {
  const known = findSeries(prompt);
  if (known) return known.sourceUrl;
  const symbol = extractSymbol(prompt)?.toLowerCase();
  return symbol ? `https://tradingeconomics.com/${encodeURIComponent(symbol)}` : undefined;
};

export const tradingEconomicsMarketTemplate: ConnectorTemplate<{
  symbol: string;
  label: string;
  unit: string;
  sourceUrl: string;
  apiKey?: string;
}> = {
  id: 'trading-economics-market',
  displayName: 'Trading Economics market',
  configSchema: z.object({
    symbol: z.string().min(1),
    label: z.string().min(1),
    unit: z.string(),
    sourceUrl: z.url(),
    apiKey: z.string().optional(),
  }),
  paramKeys: ['symbol', 'label', 'unit', 'sourceUrl'] as const,
  matchHints: [
    /\btrading\s+economics\b/i,
    /\b(?:uk\s+10y|gilt|government\s+bond|gbp\s*\/?\s*usd|sterling|gold|crude\s+oil|wti)\b/i,
  ],
  paramExtractors: {
    symbol: extractSymbol,
    label: extractLabel,
    unit: extractUnit,
    sourceUrl: extractSourceUrl,
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 21_600,
  serverSecret: {
    env: 'TRADING_ECONOMICS_API_KEY',
    configKey: 'apiKey',
    setupMessage: 'Set TRADING_ECONOMICS_API_KEY to enable Trading Economics market cards.',
  },
  adapter: (config) =>
    tradingEconomicsMarket({
      symbol: config.symbol,
      label: config.label,
      unit: config.unit,
      sourceUrl: config.sourceUrl,
      apiKey: config.apiKey,
      days: 365,
    }),
};
