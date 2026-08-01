import type { PublicCollectionResponse } from '@antenna/shared';

import { fetchJson } from './http';

export function getPublicCollection(slug: string): Promise<PublicCollectionResponse> {
  return fetchJson<PublicCollectionResponse>(`/api/public/collections/${encodeURIComponent(slug)}`);
}
