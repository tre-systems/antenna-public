import { describe, it, expect } from 'vitest';
import { configKeyLabel } from './configLabels';

describe('configKeyLabel', () => {
  it('maps known config keys to human-friendly labels', () => {
    expect(configKeyLabel('calendarId')).toBe('Calendar ID');
    expect(configKeyLabel('hoursAhead')).toBe('Hours ahead');
    expect(configKeyLabel('base')).toBe('Base currency');
    expect(configKeyLabel('jsonPath')).toBe('JSON path');
    expect(configKeyLabel('lat')).toBe('Latitude');
  });

  it('falls back to sentence-cased camelCase or snake_case', () => {
    expect(configKeyLabel('someCustomThing')).toBe('Some custom thing');
    expect(configKeyLabel('snake_case_key')).toBe('Snake case key');
    expect(configKeyLabel('plain')).toBe('Plain');
  });

  it('returns the original key when it can not be split', () => {
    expect(configKeyLabel('')).toBe('');
  });
});
