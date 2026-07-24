import { countCollectionsForUser, collectionQuotaFromCount } from '../collection-quota';
import type { Client, CollectionsContext } from './types';

export const collectionQuotaError = async (
  c: CollectionsContext,
  client: Client,
  userId: string,
): Promise<Response | undefined> => {
  const used = await countCollectionsForUser(client, userId);
  const quota = collectionQuotaFromCount(used);
  return quota.can_create ? undefined : c.json({ error: 'collection_quota_exceeded', quota }, 409);
};
