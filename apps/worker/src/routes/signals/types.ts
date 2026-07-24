import type { Context } from 'hono';
import type { ExecutionMode, SourceRightsStatus } from '@antenna/registry';
import type { SignalStatusValue } from '@antenna/shared';
import type { AuthVars } from '../../auth/middleware';
import type { Env as DbEnv, db } from '../../db/client';
import type { signalStatus, signals } from '../../db/schema';
import type { Visibility } from '../../policy/source-access';

export type Bindings = DbEnv;
export type SignalsEnv = { Bindings: Bindings; Variables: AuthVars };
export type SignalsContext = Context<SignalsEnv>;
export type Client = ReturnType<typeof db>;
export type SignalRow = typeof signals.$inferSelect;
export type StatusRow = typeof signalStatus.$inferSelect;

export type SignalWithStatus = {
  readonly signal: SignalRow;
  readonly status: StatusRow | null;
};

export type StatusShape = {
  readonly status: SignalStatusValue | null;
  readonly last_ok_at: number | null;
  readonly last_attempt_at: number | null;
  readonly last_error: string | null;
  readonly last_manual_request_at: number | null;
};

export type PointDisplayShape = {
  readonly label: string;
  readonly source_url: string | null;
};

export type PointShape = {
  readonly observed_at: number;
  readonly fetched_at: number;
  readonly metric_key: string;
  readonly dimensions: Readonly<Record<string, string>> | null;
  readonly value: number | null;
  readonly value_text: string | null;
  readonly unit: string | null;
  readonly source_url: string | null;
  readonly display: PointDisplayShape;
};

export type DisplayShape = {
  readonly title: string;
  readonly source_label: string;
  readonly source_url: string | null;
};

export type SourcePolicyShape = {
  readonly source_id: string;
  readonly label: string;
  readonly source_url: string;
  readonly rights_status: SourceRightsStatus;
  readonly execution_mode: ExecutionMode;
  readonly public_display_eligible: boolean;
  readonly public_display_blocker: string | null;
  readonly attribution: string;
  readonly last_reviewed: string;
};

export type SignalShape = {
  readonly id: string;
  readonly template_id: string;
  readonly title: string;
  readonly visibility: Visibility;
  readonly display: DisplayShape;
  readonly config: Readonly<Record<string, unknown>>;
  readonly refresh_seconds: number;
  readonly source_policy: SourcePolicyShape | null;
  readonly status: StatusShape;
  readonly points: ReadonlyArray<PointShape>;
};

export type HistoryShape = {
  readonly signal_id: string;
  readonly range: string;
  readonly points: ReadonlyArray<PointShape>;
};
