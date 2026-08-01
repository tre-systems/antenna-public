import type {
  ConnectorRequestRecord,
  CollectionListItem,
  PlanRecord,
  TemplateRecord,
} from '@antenna/shared';
import type {
  ConfirmPlanResult,
  AntennaClient,
  RefreshSignalResult,
  RemoveSignalResult,
  ReorderSignalsResult,
  RejectPlanResult,
  UpdateSignalResult,
} from './client.js';
import {
  summarizeSignal,
  type ConfirmPlanInput,
  type GetSignalHistoryInput,
  type GetSignalInput,
  type GetCollectionInput,
  type ListSignalsInput,
  type McpSignalDetail,
  type McpSignalHistory,
  type McpSignalSummary,
  type McpCollectionDetail,
  type ProposeSignalInput,
  type ProposeTemplateSignalInput,
  type RefreshSignalInput,
  type RejectPlanInput,
  type RemoveSignalInput,
  type ReorderSignalsInput,
  type UpdateSignalInput,
} from './tool-signals.js';

export type * from './tool-signals.js';

export async function listSignalsTool(
  client: AntennaClient,
  input: ListSignalsInput = {},
): Promise<McpSignalSummary[]> {
  const signals = await client.listSignals(input);
  return signals.map(summarizeSignal);
}

export async function getSignalHistoryTool(
  client: AntennaClient,
  input: GetSignalHistoryInput,
): Promise<McpSignalHistory> {
  const range = input.range ?? '1y';
  const { points } = await client.getSignalHistory(input.signalId, range);
  return {
    signal_id: input.signalId,
    range,
    points,
  };
}

export async function getSignalTool(
  client: AntennaClient,
  input: GetSignalInput,
): Promise<McpSignalDetail | null> {
  const signal = await client.getSignal(input.signalId);
  return signal ? { ...summarizeSignal(signal), points: signal.points } : null;
}

export function listConnectorRequestsTool(
  client: AntennaClient,
): Promise<ConnectorRequestRecord[]> {
  return client.listConnectorRequests();
}

export function listTemplatesTool(client: AntennaClient): Promise<TemplateRecord[]> {
  return client.listTemplates();
}

export function listCollectionsTool(client: AntennaClient): Promise<readonly CollectionListItem[]> {
  return client.listCollections();
}

export async function getCollectionTool(
  client: AntennaClient,
  input: GetCollectionInput,
): Promise<McpCollectionDetail> {
  const detail = await client.getCollection(input.collectionId);
  return {
    collection: detail.collection,
    signals: detail.signals.map(summarizeSignal),
  };
}

export function refreshSignalTool(
  client: AntennaClient,
  input: RefreshSignalInput,
): Promise<RefreshSignalResult> {
  return client.refreshSignal(input.signalId);
}

export function updateSignalTool(
  client: AntennaClient,
  input: UpdateSignalInput,
): Promise<UpdateSignalResult> {
  return client.updateSignal(input.signalId, {
    config: input.config,
    refresh_seconds: input.refreshSeconds,
    visibility: input.visibility,
  });
}

export function removeSignalTool(
  client: AntennaClient,
  input: RemoveSignalInput,
): Promise<RemoveSignalResult> {
  return client.removeSignal(input.signalId);
}

export function reorderSignalsTool(
  client: AntennaClient,
  input: ReorderSignalsInput,
): Promise<ReorderSignalsResult> {
  return client.reorderSignals(input.orderedSignalIds, input.collectionId);
}

export function proposeSignalTool(
  client: AntennaClient,
  input: ProposeSignalInput,
): Promise<PlanRecord> {
  return client.proposeSignal(input.prompt, input.collectionId);
}

export function proposeTemplateSignalTool(
  client: AntennaClient,
  input: ProposeTemplateSignalInput,
): Promise<PlanRecord> {
  return client.proposeTemplateSignal(input.templateId, input.collectionId);
}

export function rejectPlanTool(
  client: AntennaClient,
  input: RejectPlanInput,
): Promise<RejectPlanResult> {
  return client.rejectPlan(input.planId);
}

export function confirmPlanTool(
  client: AntennaClient,
  input: ConfirmPlanInput,
): Promise<ConfirmPlanResult> {
  return client.confirmPlan(input.planId, { edited_signals: input.editedSignals });
}
