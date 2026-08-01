import type {
  CollectionDeleteResponse,
  CollectionDetailResponse,
  CollectionListResponse,
  CollectionRecord,
  CollectionTemplateListResponse,
} from '@antenna/shared';

import { fetchJson } from './http';

export function getCollection(): Promise<CollectionRecord> {
  return fetchJson<CollectionRecord>('/api/collection');
}

export function listCollections(): Promise<CollectionListResponse> {
  return fetchJson<CollectionListResponse>('/api/collections');
}

export function getCollectionById(id: string): Promise<CollectionDetailResponse> {
  return fetchJson<CollectionDetailResponse>(`/api/collections/${encodeURIComponent(id)}`);
}

export function createCollection(body: {
  title: string;
  description?: string | null;
  visibility?: CollectionRecord['visibility'];
  template_id?: string;
}): Promise<CollectionRecord> {
  return fetchJson<CollectionRecord>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCollection(
  patch: {
    title?: string;
    description?: string | null;
    visibility?: CollectionRecord['visibility'];
    layout?: CollectionRecord['layout'];
  },
  collectionId?: string,
): Promise<CollectionRecord> {
  return fetchJson<CollectionRecord>(collectionPath(collectionId), {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteCollection(id: string): Promise<CollectionDeleteResponse> {
  return fetchJson<CollectionDeleteResponse>(`/api/collections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getCollectionTemplates(): Promise<CollectionTemplateListResponse> {
  return fetchJson<CollectionTemplateListResponse>('/api/templates/collections');
}

const collectionPath = (collectionId: string | undefined): string =>
  collectionId === undefined
    ? '/api/collection'
    : `/api/collections/${encodeURIComponent(collectionId)}`;
