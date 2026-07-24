import type { SharedCollectionResponse } from '@antenna/shared';

import { fetchJson } from './http';

export function getSharedCollection(slug: string): Promise<SharedCollectionResponse> {
  return fetchJson<SharedCollectionResponse>(`/api/shared/collections/${encodeURIComponent(slug)}`);
}
