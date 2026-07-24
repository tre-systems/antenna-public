import type {
  ApiSignal,
  SignalStatusValue,
  ConnectorRequestRecord,
  CollectionDetailResponse,
  CollectionListResponse,
  HistoryPoint,
  PlanRecord,
  TemplateRecord,
} from '@antenna/shared';
import type {
  ConfirmPlanInput,
  ConfirmPlanResult,
  CollectionList,
  ListSignalsFilter,
  AntennaClientOptions,
  RefreshSignalResult,
  RejectPlanResult,
  RemoveSignalResult,
  ReorderSignalsResult,
  UpdateSignalInput,
  UpdateSignalResult,
} from './client-types.js';
import { normalizeBaseUrl, normalizeCookie } from './url.js';

export type {
  ConfirmPlanSignalPatch,
  ConfirmPlanInput,
  ConfirmPlanResult,
  CollectionList,
  FetchLike,
  ListSignalsFilter,
  AntennaClientOptions,
  RefreshSignalResult,
  RejectPlanResult,
  RemoveSignalResult,
  ReorderSignalsResult,
  UpdateSignalInput,
  UpdateSignalResult,
} from './client-types.js';

export class AntennaApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: string,
  ) {
    const detail = body ? `: ${body.slice(0, 200)}` : '';
    super(`Antenna API request failed: ${status} ${statusText}${detail}`);
    this.name = 'AntennaApiError';
  }
}

export type AntennaReadClient = ReturnType<typeof createAntennaReadClient>;

export function createAntennaReadClient(options: AntennaClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(new URL(path, baseUrl), {
      ...init,
      headers: createHeaders(options, init.headers),
    });
    if (!response.ok) {
      throw new AntennaApiError(
        response.status,
        response.statusText,
        await response.text().catch(() => ''),
      );
    }
    return (await response.json()) as T;
  }

  const getJson = <T>(path: string): Promise<T> => requestJson<T>(path);
  const postJson = <T>(path: string): Promise<T> => requestJson<T>(path, { method: 'POST' });

  return {
    async listSignals(filter: ListSignalsFilter = {}): Promise<ApiSignal[]> {
      const params = new URLSearchParams();
      if (filter.collectionId !== undefined) params.set('collection_id', filter.collectionId);
      const path = params.size === 0 ? '/api/signals' : `/api/signals?${params.toString()}`;
      const signals = await getJson<ApiSignal[]>(path);
      return signals.filter((signal) => {
        if (filter.status !== undefined && listFilterStatus(signal) !== filter.status) return false;
        if (filter.templateId !== undefined && signal.template_id !== filter.templateId) {
          return false;
        }
        return true;
      });
    },
    async getSignal(signalId: string): Promise<ApiSignal | null> {
      try {
        return await getJson<ApiSignal>(`/api/signals/${encodeURIComponent(signalId)}`);
      } catch (caught) {
        if (caught instanceof AntennaApiError && caught.status === 404) return null;
        throw caught;
      }
    },
    getSignalHistory(signalId: string, range = '1y'): Promise<{ points: HistoryPoint[] }> {
      const params = new URLSearchParams({ range });
      return getJson<{ points: HistoryPoint[] }>(
        `/api/signals/${encodeURIComponent(signalId)}/history?${params.toString()}`,
      );
    },
    listConnectorRequests(): Promise<ConnectorRequestRecord[]> {
      return getJson<ConnectorRequestRecord[]>('/api/requests');
    },
    listTemplates(): Promise<TemplateRecord[]> {
      return getJson<TemplateRecord[]>('/api/templates');
    },
    async listCollections(): Promise<CollectionList> {
      const response = await getJson<CollectionListResponse>('/api/collections');
      return response.collections;
    },
    getCollection(collectionId: string): Promise<CollectionDetailResponse> {
      return getJson<CollectionDetailResponse>(
        `/api/collections/${encodeURIComponent(collectionId)}`,
      );
    },
    refreshSignal(signalId: string): Promise<RefreshSignalResult> {
      return postJson<RefreshSignalResult>(`/api/signals/${encodeURIComponent(signalId)}/refresh`);
    },
    updateSignal(signalId: string, input: UpdateSignalInput): Promise<UpdateSignalResult> {
      return requestJson<UpdateSignalResult>(`/api/signals/${encodeURIComponent(signalId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    removeSignal(signalId: string): Promise<RemoveSignalResult> {
      return requestJson<RemoveSignalResult>(`/api/signals/${encodeURIComponent(signalId)}`, {
        method: 'DELETE',
      });
    },
    reorderSignals(
      orderedSignalIds: readonly string[],
      collectionId?: string,
    ): Promise<ReorderSignalsResult> {
      const path =
        collectionId === undefined
          ? '/api/collection/signals/order'
          : `/api/collections/${encodeURIComponent(collectionId)}/signals/order`;
      return requestJson<ReorderSignalsResult>(path, {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: orderedSignalIds }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    proposeSignal(prompt: string): Promise<PlanRecord> {
      return requestJson<PlanRecord>('/api/plan', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    rejectPlan(planId: string): Promise<RejectPlanResult> {
      return postJson<RejectPlanResult>(`/api/plan/${encodeURIComponent(planId)}/reject`);
    },
    confirmPlan(planId: string, input: ConfirmPlanInput = {}): Promise<ConfirmPlanResult> {
      return requestJson<ConfirmPlanResult>(`/api/plan/${encodeURIComponent(planId)}/confirm`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}

function listFilterStatus(signal: ApiSignal): SignalStatusValue | null {
  if (signal.status.status !== null) return signal.status.status;
  if (signal.status.last_ok_at === null && signal.status.last_attempt_at === null) return 'loading';
  return null;
}

function createHeaders(options: AntennaClientOptions, extraHeaders?: HeadersInit): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (extraHeaders !== undefined) {
    new Headers(extraHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  if (options.token !== undefined) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.sessionCookie !== undefined) {
    headers.set('Cookie', normalizeCookie(options.sessionCookie));
  }
  return headers;
}
