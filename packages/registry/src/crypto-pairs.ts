const KNOWN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE'] as const;
const SYMBOL_ALIASES: Record<string, (typeof KNOWN_SYMBOLS)[number]> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  cardano: 'ADA',
  dogecoin: 'DOGE',
};

export const extractPairs = (prompt: string): string | undefined => {
  const found = new Set<string>();
  const lower = prompt.toLowerCase();

  for (const symbol of KNOWN_SYMBOLS) {
    if (new RegExp(`\\b${symbol}\\b`, 'i').test(prompt)) found.add(symbol);
  }
  for (const [alias, symbol] of Object.entries(SYMBOL_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) found.add(symbol);
  }

  if (found.size === 0) return undefined;
  return [...found].map((s) => `${s}-USD`).join(',');
};
