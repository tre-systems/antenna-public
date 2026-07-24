import type {
  PublicCollectionListResponse,
  PublicCollectionReportResponse,
  PublicCollectionResponse,
} from '@antenna/shared';

import { fetchJson } from './http';

export type ReportCollectionCategory = 'broken' | 'inappropriate' | 'spam' | 'other';

export function getPublicCollection(slug: string): Promise<PublicCollectionResponse> {
  return fetchJson<PublicCollectionResponse>(`/api/public/collections/${encodeURIComponent(slug)}`);
}

export function listPublicCollections(
  opts: { limit?: number; offset?: number } = {},
): Promise<PublicCollectionListResponse> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return fetchJson<PublicCollectionListResponse>(`/api/public/collections${qs ? `?${qs}` : ''}`);
}

export function reportPublicCollection(
  slug: string,
  body: { category: ReportCollectionCategory; message?: string },
): Promise<PublicCollectionReportResponse> {
  return fetchJson<PublicCollectionReportResponse>(
    `/api/public/collections/${encodeURIComponent(slug)}/report`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}
