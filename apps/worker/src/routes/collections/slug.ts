import type { Visibility } from '../../policy/source-access';

export const newCollectionSlug = (randomUuid: () => string = () => crypto.randomUUID()): string =>
  randomUuid().replaceAll('-', '');

export const collectionSlugForVisibility = (
  currentVisibility: Visibility,
  currentSlug: string | null,
  nextVisibility: Visibility,
): string | null => {
  if (nextVisibility === 'private') return null;
  if (currentVisibility === 'private' || currentSlug === null) return newCollectionSlug();
  return currentSlug;
};
