import type { PlanRecord } from '@antenna/shared';

import { fetchJson } from './http';

export function submitPrompt(prompt: string, collectionId?: string): Promise<PlanRecord> {
  return fetchJson<PlanRecord>('/api/plan', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      ...(collectionId === undefined ? {} : { collection_id: collectionId }),
    }),
  });
}

export function confirmPlan(
  planId: string,
  editedSignals?: Array<{ config?: Record<string, unknown> }>,
): Promise<{ created_signal_ids: string[] }> {
  const body =
    editedSignals === undefined ? {} : { edited_signals: editedSignalConfigs(editedSignals) };
  return fetchJson<{ created_signal_ids: string[] }>(
    `/api/plan/${encodeURIComponent(planId)}/confirm`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function rejectPlan(planId: string): Promise<{ ok: true }> {
  return fetchJson<{ ok: true }>(`/api/plan/${encodeURIComponent(planId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

const editedSignalConfigs = (
  signals: Array<{ config?: Record<string, unknown> }>,
): Array<{ config?: Record<string, unknown> }> =>
  signals.map((signal) => ({
    ...(signal.config === undefined ? {} : { config: signal.config }),
  }));
