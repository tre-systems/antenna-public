import { describe, expect, it } from 'vitest';
import { configPatchFromDraft } from './config-draft';

describe('configPatchFromDraft', () => {
  it('patches edited scalar config without sending hidden config', () => {
    const next = configPatchFromDraft(
      { location: 'London', lat: 51.5 },
      { location: 'Edinburgh', lat: 55.95 },
    );
    expect(next).toEqual({ location: 'Edinburgh', lat: 55.95 });
  });

  it('uses null to remove an editable key omitted from the pending draft', () => {
    const next = configPatchFromDraft({ location: 'London', lat: 51.5 }, { location: 'London' });
    expect(next).toEqual({ location: 'London', lat: null });
  });
});
