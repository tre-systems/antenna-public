import type {
  RightsStatus,
  SourceAcquisitionState,
  SourceAcquisitionStrategy,
  SourceBlockerReason,
} from './source-types';

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
