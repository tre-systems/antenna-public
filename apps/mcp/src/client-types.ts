import type { SignalStatusValue, CollectionListItem, Visibility } from '@antenna/shared';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type AntennaClientOptions = {
  readonly baseUrl: string;
  readonly sessionCookie?: string;
  readonly token?: string;
  readonly fetchImpl?: FetchLike;
};

export type ListSignalsFilter = {
  readonly collectionId?: string;
  readonly status?: SignalStatusValue;
  readonly templateId?: string;
};

export type RefreshSignalResult = {
  readonly requested: true;
};

export type RejectPlanResult = {
  readonly ok: true;
};

export type ConfirmPlanSignalPatch = {
  readonly config?: Readonly<Record<string, unknown>>;
};

export type ConfirmPlanInput = {
  readonly edited_signals?: ReadonlyArray<ConfirmPlanSignalPatch>;
};

export type ConfirmPlanResult = {
  readonly created_signal_ids: readonly string[];
};

export type UpdateSignalInput = {
  readonly config?: Readonly<Record<string, unknown>>;
  readonly refresh_seconds?: number;
  readonly visibility?: Visibility;
};

export type UpdateSignalResult = {
  readonly updated: true;
  readonly config: Readonly<Record<string, unknown>>;
  readonly refresh_seconds: number;
  readonly visibility: Visibility;
  readonly cleared_points: boolean;
};

export type RemoveSignalResult = {
  readonly deleted: true;
};

export type ReorderSignalsResult = {
  readonly updated: true;
  readonly ordered_signal_ids: readonly string[];
};

export type CollectionList = readonly CollectionListItem[];
