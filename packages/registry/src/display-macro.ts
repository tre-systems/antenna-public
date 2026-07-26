export type MacroPreset = {
  readonly label: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
};

const MACRO_PRESETS: Readonly<Record<string, MacroPreset>> = {
  'uk-10y-gilt': {
    label: 'UK 10Y gilt',
    sourceLabel: 'Bank of England',
    sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/',
  },
  'gbp-usd': {
    label: 'GBP/USD',
    sourceLabel: 'Frankfurter (ECB)',
    sourceUrl: 'https://frankfurter.dev/',
  },
  gold: {
    label: 'Gold',
    sourceLabel: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/quote/GC=F/',
  },
  'crude-oil': {
    label: 'Crude oil',
    sourceLabel: 'EIA',
    sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm',
  },
};

export const macroPreset = (
  templateId: string,
  config: Readonly<Record<string, unknown>>,
): MacroPreset | null => {
  if (templateId !== 'macro-market-history') return null;
  const preset = config.preset;
  return typeof preset === 'string' ? (MACRO_PRESETS[preset] ?? null) : null;
};
