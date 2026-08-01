import { Hono } from 'hono';
import { createCollection } from './collections/create-handler';
import { getCollection, listCollections } from './collections/read-handlers';
import {
  deleteCollection,
  reorderCollectionSignals,
  updateCollection,
} from './collections/write-handlers';
import type { CollectionsEnv } from './collections/types';

export const collectionsRoute = new Hono<CollectionsEnv>()
  .get('/', listCollections)
  .get('/:id', getCollection)
  .patch('/:id/signals/order', reorderCollectionSignals)
  .patch('/:id', updateCollection)
  .post('/', createCollection)
  .delete('/:id', deleteCollection);
