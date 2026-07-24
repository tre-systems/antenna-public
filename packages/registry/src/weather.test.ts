import { describe, expect, it } from 'vitest';
import { weatherTemplate } from './weather';

const anyHintMatches = (prompt: string): boolean =>
  weatherTemplate.matchHints.some((rx) => rx.test(prompt));

describe('weatherTemplate.matchHints', () => {
  it.each([
    'show me the weather in Berlin',
    'temperature today',
    'is it hot in Athens',
    'how cold will it be tomorrow',
    'humidity in Lagos',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['EUR/USD rate', 'bitcoin price', 'football scores'])('does not match "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(false);
  });
});

describe('weatherTemplate.paramExtractors.location', () => {
  const { location } = weatherTemplate.paramExtractors;

  it('extracts location after "in"', () => {
    expect(location?.('weather in Berlin')).toBe('Berlin');
  });

  it('extracts location after "at"', () => {
    expect(location?.('temperature at Heathrow.')).toBe('Heathrow');
  });

  it('returns undefined when there is no preposition', () => {
    expect(location?.('how hot today')).toBeUndefined();
  });
});

describe('weatherTemplate.adapter', () => {
  it('fails when lat/lon are missing', async () => {
    const result = await weatherTemplate.adapter({ location: 'Berlin' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });
});
