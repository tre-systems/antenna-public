import { describe, expect, it } from 'vitest';
import type { TemplateRecord } from '@antenna/shared';
import { matchesQuery } from './SourceBrowser';

const template = {
  id: 'fx-pair',
  display_name: 'FX pair',
  source_policy: { label: 'Frankfurter (ECB)' },
} as TemplateRecord;

describe('matchesQuery', () => {
  it('matches display names, ids, and source labels', () => {
    expect(matchesQuery(template, 'FX pair')).toBe(true);
    expect(matchesQuery(template, 'fx-pair')).toBe(true);
    expect(matchesQuery(template, 'ECB')).toBe(true);
    expect(matchesQuery(template, 'weather')).toBe(false);
  });
});
