import { describe, expect, it } from 'vitest';
import { collectionSlugForVisibility, newCollectionSlug } from './slug';

describe('collection share slugs', () => {
  it('uses the full UUID entropy without URL punctuation', () => {
    expect(newCollectionSlug(() => '12345678-1234-4abc-8def-1234567890ab')).toBe(
      '1234567812344abc8def1234567890ab',
    );
  });

  it('revokes the capability when made private and rotates it when reshared', () => {
    expect(collectionSlugForVisibility('shared', 'old-capability', 'private')).toBeNull();
    expect(collectionSlugForVisibility('private', 'legacy-capability', 'shared')).not.toBe(
      'legacy-capability',
    );
  });

  it('keeps an active external link stable while visibility remains external', () => {
    expect(collectionSlugForVisibility('shared', 'current-capability', 'public')).toBe(
      'current-capability',
    );
  });
});
