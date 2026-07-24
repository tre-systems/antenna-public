import { templates, type CollectionTemplate } from '@antenna/registry';
import type {
  SignalConfig,
  signalStatus as signalStatusTable,
  signals as signalTable,
} from '../../db/schema';
import type { Visibility } from '../../policy/source-access';
import { externalVisibilityDecision } from './source-policy';

type TemplateRows = {
  readonly ok: true;
  readonly signals: Array<typeof signalTable.$inferInsert>;
  readonly statuses: Array<typeof signalStatusTable.$inferInsert>;
};

type TemplateRowsFailure =
  | { readonly ok: false; readonly error: 'invalid_collection_template' }
  | { readonly ok: false; readonly error: 'source_policy_blocked'; readonly reason: string };

export type TemplateRowsResult = TemplateRows | TemplateRowsFailure;

export const emptyTemplateRows = (): TemplateRows => ({
  ok: true,
  signals: [],
  statuses: [],
});

export const materializeCollectionTemplateSignals = (
  template: CollectionTemplate,
  collectionId: string,
  collectionVisibility: Visibility,
  now: Date,
): TemplateRowsResult => {
  const signalRows: Array<typeof signalTable.$inferInsert> = [];
  const statuses: Array<typeof signalStatusTable.$inferInsert> = [];

  for (const [position, signal] of template.signals.entries()) {
    const row = materializeTemplateSignal(
      signal,
      collectionId,
      collectionVisibility,
      position,
      now,
    );
    if (!row.ok) return row;
    signalRows.push(row.signal);
    statuses.push(row.status);
  }

  return { ok: true, signals: signalRows, statuses };
};

const materializeTemplateSignal = (
  signal: CollectionTemplate['signals'][number],
  collectionId: string,
  collectionVisibility: Visibility,
  position: number,
  now: Date,
):
  | TemplateRowsFailure
  | {
      readonly ok: true;
      readonly signal: typeof signalTable.$inferInsert;
      readonly status: typeof signalStatusTable.$inferInsert;
    } => {
  const connectorTemplate = templates.find((candidate) => candidate.id === signal.templateId);
  if (!connectorTemplate) return { ok: false, error: 'invalid_collection_template' };

  const config = connectorTemplate.configSchema.safeParse(signal.config);
  if (!config.success) return { ok: false, error: 'invalid_collection_template' };

  const sourceDecision = externalVisibilityDecision(signal.templateId, collectionVisibility);
  if (!sourceDecision.ok) {
    return { ok: false, error: 'source_policy_blocked', reason: sourceDecision.reason };
  }

  const signalId = crypto.randomUUID();
  return {
    ok: true,
    signal: {
      id: signalId,
      collectionId,
      templateId: signal.templateId,
      title: signal.title,
      config: JSON.stringify(config.data) as unknown as SignalConfig,
      refreshSeconds: signal.refreshSeconds ?? connectorTemplate.defaultRefreshSeconds,
      position,
      visibility: collectionVisibility,
      createdAt: now,
      updatedAt: now,
    },
    status: {
      signalId,
      status: 'loading',
      updatedAt: now,
    },
  };
};
