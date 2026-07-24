import type {
  SignalAlertListResponse,
  NotificationPreferenceResponse,
  NotificationPreferencesResponse,
} from '@antenna/shared';

import { fetchJson } from './http';

export function getAlerts(
  opts: { collection_id?: string; since?: number; limit?: number } = {},
): Promise<SignalAlertListResponse> {
  const params = new URLSearchParams();
  if (opts.collection_id !== undefined) params.set('collection_id', opts.collection_id);
  if (opts.since !== undefined) params.set('since', String(opts.since));
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<SignalAlertListResponse>(`/api/alerts${qs ? `?${qs}` : ''}`);
}

export function getNotificationPreferences(
  collectionId?: string,
): Promise<NotificationPreferencesResponse> {
  const params = new URLSearchParams();
  if (collectionId !== undefined) params.set('collection_id', collectionId);
  const qs = params.toString();
  return fetchJson<NotificationPreferencesResponse>(
    `/api/notifications/preferences${qs ? `?${qs}` : ''}`,
  );
}

export function updateNotificationPreference(
  channel: 'daily_digest',
  patch: {
    collection_id?: string | null;
    enabled?: boolean;
    frequency?: 'daily' | 'weekly';
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
  },
): Promise<NotificationPreferenceResponse> {
  return fetchJson<NotificationPreferenceResponse>(
    `/api/notifications/preferences/${encodeURIComponent(channel)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}
