import type { ApiSignal, DataPoint, CollectionRecord, HistoryPoint } from '@antenna/shared';
import type { ConfirmPlanSignalPatch, ListSignalsFilter } from './client.js';

export type ListSignalsInput = ListSignalsFilter;

export type GetSignalHistoryInput = {
  readonly signalId: string;
  readonly range?: string;
};

export type GetSignalInput = {
  readonly signalId: string;
};

export type RefreshSignalInput = {
  readonly signalId: string;
};

export type ProposeSignalInput = {
  readonly prompt: string;
};

export type RejectPlanInput = {
  readonly planId: string;
};

export type ConfirmPlanInput = {
  readonly planId: string;
  readonly editedSignals?: ReadonlyArray<ConfirmPlanSignalPatch>;
};

export type UpdateSignalInput = {
  readonly signalId: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly refreshSeconds?: number;
  readonly visibility?: ApiSignal['visibility'];
};

export type RemoveSignalInput = {
  readonly signalId: string;
};

export type ReorderSignalsInput = {
  readonly collectionId?: string;
  readonly orderedSignalIds: readonly string[];
};

export type GetCollectionInput = {
  readonly collectionId: string;
};

export type McpCollectionDetail = {
  readonly collection: CollectionRecord;
  readonly signals: readonly McpSignalSummary[];
};

export type McpSignalSummary = {
  readonly id: string;
  readonly template_id: string;
  readonly title: string | null;
  readonly source_label: string | null;
  readonly source_url: string | null;
  readonly config: Readonly<Record<string, unknown>>;
  readonly refresh_seconds: number;
  readonly visibility: ApiSignal['visibility'];
  readonly source_policy: ApiSignal['source_policy'];
  readonly status: ApiSignal['status'];
  readonly latest_point: DataPoint | null;
};

export type McpSignalHistory = {
  readonly signal_id: string;
  readonly range: string;
  readonly points: readonly HistoryPoint[];
};

export type McpSignalDetail = McpSignalSummary & {
  readonly points: readonly DataPoint[];
};

export function summarizeSignal(signal: ApiSignal): McpSignalSummary {
  return {
    id: signal.id,
    template_id: signal.template_id,
    title: signal.display?.title ?? signal.title ?? null,
    source_label: signal.display?.source_label ?? signal.source_policy?.label ?? null,
    source_url: signal.display?.source_url ?? null,
    config: signal.config,
    refresh_seconds: signal.refresh_seconds,
    visibility: signal.visibility,
    source_policy: signal.source_policy,
    status: signal.status,
    latest_point: signal.points[0] ?? null,
  };
}
