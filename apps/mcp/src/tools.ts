import type {
  ConnectorRequestRecord,
  CollectionListItem,
  PlanRecord,
  TemplateRecord,
} from '@antenna/shared';
import type {
  ConfirmPlanResult,
  AntennaReadClient,
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
  type RefreshSignalInput,
  type RejectPlanInput,
  type RemoveSignalInput,
  type ReorderSignalsInput,
  type UpdateSignalInput,
} from './tool-signals.js';

export type {
  ConfirmPlanInput,
  GetSignalHistoryInput,
  GetSignalInput,
  GetCollectionInput,
  ListSignalsInput,
  McpSignalDetail,
  McpSignalHistory,
  McpSignalSummary,
  McpCollectionDetail,
  ProposeSignalInput,
  RefreshSignalInput,
  RejectPlanInput,
  RemoveSignalInput,
  ReorderSignalsInput,
  UpdateSignalInput,
} from './tool-signals.js';

export async function listSignalsTool(
  client: AntennaReadClient,
  input: ListSignalsInput = {},
): Promise<McpSignalSummary[]> {
  const signals = await client.listSignals(input);
  return signals.map(summarizeSignal);
}

export async function getSignalHistoryTool(
  client: AntennaReadClient,
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
  client: AntennaReadClient,
  input: GetSignalInput,
): Promise<McpSignalDetail | null> {
  const signal = await client.getSignal(input.signalId);
  return signal ? { ...summarizeSignal(signal), points: signal.points } : null;
}

export function listConnectorRequestsTool(
  client: AntennaReadClient,
): Promise<ConnectorRequestRecord[]> {
  return client.listConnectorRequests();
}

export function listTemplatesTool(client: AntennaReadClient): Promise<TemplateRecord[]> {
  return client.listTemplates();
}

export function listCollectionsTool(
  client: AntennaReadClient,
): Promise<readonly CollectionListItem[]> {
  return client.listCollections();
}

export async function getCollectionTool(
  client: AntennaReadClient,
  input: GetCollectionInput,
): Promise<McpCollectionDetail> {
  const detail = await client.getCollection(input.collectionId);
  return {
    collection: detail.collection,
    signals: detail.signals.map(summarizeSignal),
  };
}

export function refreshSignalTool(
  client: AntennaReadClient,
  input: RefreshSignalInput,
): Promise<RefreshSignalResult> {
  return client.refreshSignal(input.signalId);
}

export function updateSignalTool(
  client: AntennaReadClient,
  input: UpdateSignalInput,
): Promise<UpdateSignalResult> {
  return client.updateSignal(input.signalId, {
    config: input.config,
    refresh_seconds: input.refreshSeconds,
    visibility: input.visibility,
  });
}

export function removeSignalTool(
  client: AntennaReadClient,
  input: RemoveSignalInput,
): Promise<RemoveSignalResult> {
  return client.removeSignal(input.signalId);
}

export function reorderSignalsTool(
  client: AntennaReadClient,
  input: ReorderSignalsInput,
): Promise<ReorderSignalsResult> {
  return client.reorderSignals(input.orderedSignalIds, input.collectionId);
}

export function proposeSignalTool(
  client: AntennaReadClient,
  input: ProposeSignalInput,
): Promise<PlanRecord> {
  return client.proposeSignal(input.prompt);
}

export function rejectPlanTool(
  client: AntennaReadClient,
  input: RejectPlanInput,
): Promise<RejectPlanResult> {
  return client.rejectPlan(input.planId);
}

export function confirmPlanTool(
  client: AntennaReadClient,
  input: ConfirmPlanInput,
): Promise<ConfirmPlanResult> {
  return client.confirmPlan(input.planId, { edited_signals: input.editedSignals });
}
