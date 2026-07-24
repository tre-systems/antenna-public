const CHARTABLE_TEMPLATES = new Set([
  'market-history',
  'crypto-history',
  'macro-market-history',
  'trading-economics-market',
  'fx-pair',
]);

export const shouldFetchHistory = (templateId: string): boolean =>
  CHARTABLE_TEMPLATES.has(templateId);
