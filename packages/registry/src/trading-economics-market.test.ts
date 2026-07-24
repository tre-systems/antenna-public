import { describe, expect, it } from 'vitest';
import { tradingEconomicsMarketTemplate } from './trading-economics-market';

const anyHintMatches = (prompt: string): boolean =>
  tradingEconomicsMarketTemplate.matchHints.some((rx) => rx.test(prompt));

describe('tradingEconomicsMarketTemplate.matchHints', () => {
  it.each([
    'Trading Economics UK 10Y gilt',
    'show gold from Trading Economics',
    'wti crude oil market pulse',
    'gbp usd yearly chart',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });
});

describe('tradingEconomicsMarketTemplate.paramExtractors', () => {
  const { symbol, label, sourceUrl } = tradingEconomicsMarketTemplate.paramExtractors;

  it('maps Rob daily collection aliases to Trading Economics symbols', () => {
    expect(symbol?.('UK 10Y gilt')).toBe('GUKG10:IND');
    expect(symbol?.('GBP/USD currency')).toBe('GBPUSD:CUR');
    expect(symbol?.('gold price')).toBe('XAUUSD:CUR');
    expect(symbol?.('WTI crude oil')).toBe('CL1:COM');
  });

  it('extracts direct Trading Economics symbols', () => {
    expect(symbol?.('chart GBPUSD:CUR')).toBe('GBPUSD:CUR');
    expect(label?.('chart GBPUSD:CUR')).toBe('GBP/USD');
    expect(sourceUrl?.('chart GBPUSD:CUR')).toBe('https://tradingeconomics.com/gbpusd:cur');
  });
});
