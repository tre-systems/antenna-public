import type { ApiSignal, HistoryPoint } from '@antenna/shared';

import { fetchJson } from './http';

export function getSignals(collectionId?: string): Promise<ApiSignal[]> {
  const params = new URLSearchParams();
  if (collectionId !== undefined) params.set('collection_id', collectionId);
  const qs = params.toString();
  return fetchJson<ApiSignal[]>(`/api/signals${qs ? `?${qs}` : ''}`);
}

export function getSignal(signalId: string): Promise<ApiSignal> {
  return fetchJson<ApiSignal>(`/api/signals/${encodeURIComponent(signalId)}`);
}

export function getSignalHistory(
  signalId: string,
  range = '1y',
): Promise<{ points: HistoryPoint[] }> {
  const encoded = encodeURIComponent(signalId);
  const params = new URLSearchParams({ range });
  return fetchJson<{ points: HistoryPoint[] }>(`/api/signals/${encoded}/history?${params}`);
}

export function updateSignal(
  signalId: string,
  patch: {
    config?: Record<string, unknown>;
    refresh_seconds?: number;
    visibility?: ApiSignal['visibility'];
  },
): Promise<{
  updated: true;
  config: Record<string, unknown>;
  refresh_seconds: number;
  visibility: ApiSignal['visibility'];
  cleared_points: boolean;
}> {
  return fetchJson(`/api/signals/${encodeURIComponent(signalId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteSignal(signalId: string): Promise<{ deleted: true }> {
  return fetchJson<{ deleted: true }>(`/api/signals/${encodeURIComponent(signalId)}`, {
    method: 'DELETE',
  });
}

export function reorderSignals(
  orderedSignalIds: readonly string[],
  collectionId?: string,
): Promise<{ updated: true; ordered_signal_ids: readonly string[] }> {
  const path =
    collectionId === undefined
      ? '/api/collection/signals/order'
      : `/api/collections/${encodeURIComponent(collectionId)}/signals/order`;
  return fetchJson(path, {
    method: 'PATCH',
    body: JSON.stringify({ ordered_signal_ids: orderedSignalIds }),
  });
}
