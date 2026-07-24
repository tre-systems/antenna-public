import { describe, expect, it } from 'vitest';
import { marketHistoryTemplate } from './market-history';

const anyHintMatches = (prompt: string): boolean =>
  marketHistoryTemplate.matchHints.some((rx) => rx.test(prompt));

describe('marketHistoryTemplate.matchHints', () => {
  it.each([
    'yearly graph for AZN.L',
    'show VTI chart',
    'share price history for SHEL.L',
    'fund chart MSFT',
    'show me AAPL.US over time',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });
});

describe('marketHistoryTemplate.paramExtractors.symbol', () => {
  const { symbol } = marketHistoryTemplate.paramExtractors;

  it('extracts Yahoo-style tickers', () => {
    expect(symbol?.('yearly graph for AZN.L')).toBe('AZN.L');
    expect(symbol?.('show VTI chart')).toBe('VTI');
    expect(symbol?.('fund chart MSFT')).toBe('MSFT');
    expect(symbol?.('show me AAPL.US over time')).toBe('AAPL.US');
  });

  it('returns undefined when no symbol is present', () => {
    expect(symbol?.('yearly graph please')).toBeUndefined();
  });
});
