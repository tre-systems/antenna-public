import type { AdapterResult } from '@antenna/connectors';
import type { templates } from '@antenna/registry';
import type { Db, Env as DbEnv } from '../../db/client';
import type { signalStatus, collections, signals } from '../../db/schema';
import type { NotifyEnv } from '../notify';

export type DispatchEnv = DbEnv &
  NotifyEnv & {
    readonly PAYLOADS: R2Bucket;
    readonly GOOGLE_CLIENT_ID: string;
    readonly GOOGLE_CLIENT_SECRET: string;
    readonly ENCRYPTION_KEY: string;
    readonly TRADING_ECONOMICS_API_KEY?: string;
    readonly ARTIFICIAL_ANALYSIS_API_KEY?: string;
    readonly GITHUB_TOKEN?: string;
    readonly CF_ANALYTICS_API_TOKEN?: string;
    readonly ADMIN_EMAILS?: string;
  };

export type DispatchSummary = {
  readonly ran: number;
  readonly ok: number;
  readonly failed: number;
};

export type DispatchContext = {
  readonly runId: string;
  // Upstream calls running right now, keyed by what they are fetching, so
  // concurrent lanes asking for the same thing await one call instead of
  // issuing their own. Scoped to a single tick.
  readonly inFlight: Map<string, Promise<AdapterResult>>;
};

export type Client = Db;
export type SignalRow = typeof signals.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;
export type StatusRow = typeof signalStatus.$inferSelect;
export type DispatchTemplate = (typeof templates)[number];

export type Joined = {
  readonly signal: SignalRow;
  readonly collection: CollectionRow;
  readonly status: StatusRow | null;
};
