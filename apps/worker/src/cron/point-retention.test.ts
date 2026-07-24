import { describe, expect, it } from 'vitest';
import { groupTemplatesByRetention, shouldRunPointRetention } from './point-retention';

describe('point retention', () => {
  it('runs once in the daily UTC maintenance minute', () => {
    expect(shouldRunPointRetention(Date.parse('2026-07-17T03:17:00Z'))).toBe(true);
    expect(shouldRunPointRetention(Date.parse('2026-07-17T03:18:00Z'))).toBe(false);
  });

  it('gives every registered template a bounded retention policy', () => {
    const grouped = groupTemplatesByRetention();
    expect([...grouped.keys()].every((days) => days > 0 && days <= 400)).toBe(true);
    expect([...grouped.values()].flat()).toContain('weather');
    expect(grouped.get(14)).toContain('weather');
    expect(grouped.get(400)).toEqual(
      expect.arrayContaining(['market-history', 'crypto-history', 'macro-market-history']),
    );
  });
});
