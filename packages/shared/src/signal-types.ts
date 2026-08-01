import type { RightsStatus, SignalStatusValue, Visibility } from './source-types';

export type ApiSignalDisplay = {
  readonly title: string;
  readonly source_label: string;
  readonly source_url: string | null;
};

export type ApiPointDisplay = {
  readonly label: string;
  readonly source_url: string | null;
};

export type DataPoint = {
  readonly dimensions: Readonly<Record<string, string | number>> | null;
  readonly value: number | string | null;
  readonly value_text?: string | null;
  readonly unit?: string | null;
  readonly source_url?: string | null;
  readonly display?: ApiPointDisplay;
  readonly ts?: number;
  readonly observed_at?: number;
  readonly fetched_at?: number;
};

export type HistoryPoint = DataPoint & {
  readonly metric_key: string;
  readonly observed_at: number;
  readonly fetched_at: number;
  readonly value: number | null;
};

export type SignalStatus = {
  readonly status: SignalStatusValue | null;
  readonly last_ok_at: number | null;
  readonly last_attempt_at: number | null;
  readonly last_error: string | null;
  readonly last_manual_request_at: number | null;
};

export type ApiSignalSourcePolicy = {
  readonly source_id: string;
  readonly label: string;
  readonly source_url: string;
  readonly rights_status: RightsStatus;
  readonly execution_mode: 'public_cloud' | 'private_cloud' | 'user_side_runner';
  readonly public_display_eligible: boolean;
  readonly public_display_blocker: string | null;
  readonly attribution: string;
  readonly last_reviewed: string;
};

export type TemplateRecord = {
  readonly id: string;
  readonly display_name: string;
  readonly param_keys: ReadonlyArray<string>;
  readonly planner_enabled: boolean;
  readonly direct_proposal_enabled: boolean;
  readonly rights_status: RightsStatus;
  readonly default_refresh_seconds: number;
  readonly retain_raw_payload: boolean;
  readonly server_secret_required: boolean;
  readonly setup_message: string | null;
  readonly source_policy: ApiSignalSourcePolicy | null;
};

export type ApiSignal = {
  readonly id: string;
  readonly template_id: string;
  readonly title?: string;
  readonly visibility: Visibility;
  readonly display?: ApiSignalDisplay;
  readonly config: Readonly<Record<string, unknown>>;
  readonly refresh_seconds: number;
  readonly source_policy?: ApiSignalSourcePolicy | null;
  readonly status: SignalStatus;
  readonly points: ReadonlyArray<DataPoint>;
};

export type PublicApiSignal = Omit<ApiSignal, 'config' | 'refresh_seconds'>;
export type SharedApiSignal = PublicApiSignal;

export interface SignalAlertRecord {
  readonly id: string;
  readonly collection_id: string;
  readonly signal_id: string;
  readonly template_id: string;
  readonly title: string;
  readonly rule_id: string;
  readonly rule_label: string;
  readonly metric_key: string;
  readonly observed_at: number;
  readonly triggered_at: number;
  readonly value: number;
  readonly previous_value: number;
  readonly unit: string | null;
  readonly source_url: string | null;
}

export interface SignalAlertListResponse {
  readonly alerts: ReadonlyArray<SignalAlertRecord>;
}
