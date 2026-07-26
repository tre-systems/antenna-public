// Wire shapes for Ask Antenna. Source of truth shared across the worker (plan
// routes, persistence), the web app (composer UI, plan rendering), and the MCP
// client.

import type { z } from 'zod';
import type {
  notificationChannelSchema,
  notificationFrequencySchema,
  rightsStatusSchema,
  sourceAcquisitionStateSchema,
  sourceAcquisitionStrategySchema,
  sourceBlockerReasonSchema,
  visibilitySchema,
} from './zod-schemas';

export type RightsStatus = z.infer<typeof rightsStatusSchema>;
export type SignalStatusValue = 'live' | 'stale' | 'error' | 'loading';

export type RightsStatusCopy = {
  readonly label: string;
  readonly tooltip: string;
};

// Rights-status copy authored once here so consumers stay in lockstep; UI keeps
// only presentational styling (e.g. badge classes) local.
export const RIGHTS_STATUS_COPY: Record<RightsStatus, RightsStatusCopy> = {
  public: {
    label: 'Public source',
    tooltip: 'Public data — no credentials needed; safe for shared collections.',
  },
  'with-attribution': {
    label: 'Public · attribution',
    tooltip: 'Public data — must keep the source label and link when shared.',
  },
  'requires-auth': {
    label: 'Requires sign-in',
    tooltip: 'Needs a connected account; values stay private to you.',
  },
  'needs-review': {
    label: 'Needs review',
    tooltip: 'Source rights or execution mode need review before this can be added.',
  },
};

export interface ProposedSignal {
  readonly template_id: string;
  readonly display_name: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly missing: ReadonlyArray<string>;
  readonly refresh_seconds: number;
  readonly rights_status: RightsStatus;
  readonly source_label: string;
}

export interface UnmatchedHint {
  readonly fragment: string;
  readonly closest_template_id?: string;
  readonly blocker_reason?: SourceBlockerReason;
  readonly acquisition_state?: SourceAcquisitionState;
  readonly acquisition_strategy?: SourceAcquisitionStrategy;
}

export interface CollectionPlan {
  readonly prompt: string;
  readonly signals: ReadonlyArray<ProposedSignal>;
  readonly unmatched: ReadonlyArray<UnmatchedHint>;
}

export type PlanStatus = 'proposed' | 'confirmed' | 'rejected';

export interface PlanRecord {
  readonly id: string;
  readonly collection_id: string;
  readonly prompt: string;
  readonly status: PlanStatus;
  readonly plan: CollectionPlan;
  readonly created_at: number;
}

export interface ConnectorRequestRecord {
  readonly id: string;
  readonly prompt: string;
  readonly fragment: string;
  readonly blocker_reason?: SourceBlockerReason;
  readonly acquisition_state?: SourceAcquisitionState;
  readonly acquisition_strategy?: SourceAcquisitionStrategy;
  readonly source_label?: string;
  readonly source_url?: string;
  readonly candidate_template_id?: string;
  readonly setup_hint?: string;
  readonly rights_status?: RightsStatus;
  readonly count: number;
  readonly created_at: number;
  readonly updated_at: number;
}

export type SourceBlockerReason = z.infer<typeof sourceBlockerReasonSchema>;

export type SourceAcquisitionState = z.infer<typeof sourceAcquisitionStateSchema>;

export type SourceAcquisitionStrategy = z.infer<typeof sourceAcquisitionStrategySchema>;

export interface CollectionLayoutSlot {
  readonly signal_id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CollectionLayout {
  readonly version: number;
  readonly slots: ReadonlyArray<CollectionLayoutSlot>;
}

export type Visibility = z.infer<typeof visibilitySchema>;

export interface CollectionRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: Visibility;
  readonly slug: string | null;
  readonly layout: CollectionLayout | null;
  readonly updated_at: number;
  readonly last_seen_at?: number | null;
}

export type CollectionListItem = Pick<
  CollectionRecord,
  'id' | 'title' | 'description' | 'visibility' | 'slug' | 'updated_at'
> & {
  readonly signal_count: number;
};

export interface CollectionListResponse {
  readonly collections: ReadonlyArray<CollectionListItem>;
}

export interface CollectionDeleteResponse {
  readonly deleted: true;
  readonly id: string;
}

export interface CollectionDetailResponse {
  readonly collection: CollectionRecord;
  readonly signals: ReadonlyArray<ApiSignal>;
}

export interface CollectionSignalOrderRecord {
  readonly updated: true;
  readonly ordered_signal_ids: ReadonlyArray<string>;
}

export interface CollectionTemplateSignalRecord {
  readonly template_id: string;
  readonly display_name: string;
  readonly title: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly refresh_seconds?: number;
}

export interface CollectionTemplateRecord {
  readonly id: string;
  readonly kind: 'curated' | 'community';
  readonly label: string;
  readonly description: string;
  readonly summary: string;
  readonly source_collection_id?: string;
  readonly fork_source_slug?: string;
  readonly owner_display_name?: string;
  readonly signals: ReadonlyArray<CollectionTemplateSignalRecord>;
}

export interface CollectionTemplateListResponse {
  readonly templates: ReadonlyArray<CollectionTemplateRecord>;
}

export interface CollectionTemplatePublishRecord {
  readonly template: CollectionTemplateRecord;
  readonly skipped_signals: ReadonlyArray<CollectionForkSkippedSignal>;
}

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

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export type NotificationFrequency = z.infer<typeof notificationFrequencySchema>;

export interface NotificationPreferenceRecord {
  readonly collection_id: string | null;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  readonly frequency: NotificationFrequency;
  readonly quiet_hours_start: string | null;
  readonly quiet_hours_end: string | null;
  readonly updated_at: number | null;
}

export interface NotificationPreferencesResponse {
  readonly preferences: ReadonlyArray<NotificationPreferenceRecord>;
}

export interface NotificationPreferenceResponse {
  readonly preference: NotificationPreferenceRecord;
}

export interface CollectionForkSkippedSignal {
  readonly id: string;
  readonly title: string;
  readonly template_id: string;
  readonly reason: string;
}

export interface CollectionQuota {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly can_create: boolean;
}

export interface MeResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image_url: string | null;
  readonly first_seen_at: number;
  readonly onboarded_at: number | null;
  readonly collection_quota: CollectionQuota;
}

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
  readonly rights_status: RightsStatus;
  readonly default_refresh_seconds: number;
  readonly retain_raw_payload: boolean;
  readonly server_secret_required: boolean;
  readonly setup_message: string | null;
  readonly source_policy: ApiSignalSourcePolicy | null;
};

export type McpTokenRecord = {
  readonly id: string;
  readonly label: string | null;
  readonly created_at: number;
  readonly last_used_at: number | null;
  readonly revoked_at: number | null;
};

export type McpOAuthConnectionRecord = {
  readonly client_id: string;
  readonly name: string;
  readonly created_at: number;
  readonly last_refreshed_at: number;
  readonly access_expires_at: number;
  readonly refresh_expires_at: number;
  readonly scopes: ReadonlyArray<string>;
};

export type ApiSignalDisplay = {
  readonly title: string;
  readonly source_label: string;
  readonly source_url: string | null;
};

export type ApiPointDisplay = {
  readonly label: string;
  readonly source_url: string | null;
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

export type PublicCollectionListItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly owner_display_name: string;
  readonly updated_at: number;
  readonly signal_count: number;
};

export type PublicCollectionListResponse = {
  readonly collections: ReadonlyArray<PublicCollectionListItem>;
  readonly next_offset: number | null;
};

export type PublicCollectionReportResponse = {
  readonly id: string;
  readonly created_at: number;
};

export type PublicCollectionResponse = {
  readonly collection: CollectionRecord;
  readonly signals: ReadonlyArray<PublicApiSignal>;
};

export type SharedCollectionResponse = {
  readonly collection: CollectionRecord;
  readonly signals: ReadonlyArray<SharedApiSignal>;
};
