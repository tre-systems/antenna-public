import type { Context } from 'hono';
import type { AuthVars } from '../../auth/middleware';
import type { Env as DbEnv, db } from '../../db/client';
import type {
  signalStatus,
  collectionTemplatePublications,
  collections,
  signals,
} from '../../db/schema';
import type { Visibility } from '../../policy/source-access';

export type Bindings = DbEnv;
export type CollectionsEnv = { Bindings: Bindings; Variables: AuthVars };
export type CollectionsContext = Context<CollectionsEnv>;
export type Client = ReturnType<typeof db>;
export type CollectionRow = typeof collections.$inferSelect;
export type SignalRow = typeof signals.$inferSelect;
export type StatusRow = typeof signalStatus.$inferSelect;
export type CollectionTemplatePublicationRow = typeof collectionTemplatePublications.$inferSelect;

export type SignalWithStatus = {
  readonly signal: SignalRow;
  readonly status: StatusRow | null;
};

export type CollectionCreateInput = {
  readonly title: string;
  readonly description?: string | null;
  readonly visibility?: Visibility;
  readonly template_id?: string;
};

export type SkippedCollectionSignal = {
  readonly id: string;
  readonly title: string;
  readonly template_id: string;
  readonly reason: string;
};

export type ForkableSignalSelection = {
  readonly signals: ReadonlyArray<SignalRow>;
  readonly skipped: ReadonlyArray<SkippedCollectionSignal>;
};
