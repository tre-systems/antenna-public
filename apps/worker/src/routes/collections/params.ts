import type { CollectionsContext } from './types';

export const routeCollectionId = (c: CollectionsContext): string => c.req.param('id') ?? '';

export const routeCollectionSlug = (c: CollectionsContext): string => c.req.param('slug') ?? '';
