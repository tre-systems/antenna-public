import { describe, expect, it } from 'vitest';
import { airQualityTemplate } from './airquality';

const anyHintMatches = (prompt: string): boolean =>
  airQualityTemplate.matchHints.some((rx) => rx.test(prompt));

describe('airQualityTemplate.matchHints', () => {
  it.each([
    'air quality in Delhi',
    'show me the AQI',
    'pollution levels today',
    'is there smog in Paris',
    'PM2.5 in Beijing',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['EUR/USD', 'bitcoin price', 'football scores'])('does not match "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(false);
  });
});

describe('airQualityTemplate.paramExtractors.location', () => {
  const { location } = airQualityTemplate.paramExtractors;

  it('extracts location after "in"', () => {
    expect(location?.('air quality in Delhi')).toBe('Delhi');
  });

  it('returns undefined when no location is given', () => {
    expect(location?.('show AQI')).toBeUndefined();
  });
});

describe('airQualityTemplate.adapter', () => {
  it('fails without lat/lon', async () => {
    const result = await airQualityTemplate.adapter({ location: 'Delhi' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });
});
