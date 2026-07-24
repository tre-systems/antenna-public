import { Hono } from 'hono';
import {
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  publishCollectionTemplate,
  reorderCollectionSignals,
  updateCollection,
} from './collections/handlers';
import type { CollectionsEnv } from './collections/types';

export { COMMUNITY_TEMPLATE_ID_PREFIX } from './collections/constants';

export const collectionsRoute = new Hono<CollectionsEnv>()
  .get('/', listCollections)
  .get('/:id', getCollection)
  .patch('/:id/signals/order', reorderCollectionSignals)
  .patch('/:id', updateCollection)
  .post('/', createCollection)
  .delete('/:id', deleteCollection)
  .post('/:id/template', publishCollectionTemplate);
