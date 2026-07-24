import { resolvePointDisplay, resolveTemplateDisplay, safeExternalUrl } from '@antenna/registry';
import { parseJsonRecord, parseStringRecord, toTimestampMs } from '../../db/codecs';
import type { signalPoints } from '../../db/schema';
import { toSourcePolicyShape } from './source-policy';
import type {
  SignalRow,
  SignalShape,
  DisplayShape,
  PointShape,
  StatusRow,
  StatusShape,
} from './types';

export const buildSignal = (
  signal: SignalRow,
  status: StatusRow | null,
  points: ReadonlyArray<PointShape>,
): SignalShape => {
  const config = parseJsonRecord(signal.config);
  return {
    id: signal.id,
    template_id: signal.templateId,
    title: signal.title,
    visibility: signal.visibility,
    display: toDisplayShape(signal, config, points),
    config,
    refresh_seconds: signal.refreshSeconds,
    source_policy: toSourcePolicyShape(signal.templateId),
    status: toStatusShape(status),
    points: toDisplayPoints(signal.templateId, points),
  };
};

export const toDisplayPoints = (
  templateId: string,
  points: ReadonlyArray<PointShape>,
): ReadonlyArray<PointShape> => points.map((point) => toDisplayPoint(templateId, point));

export const toPointShape = (row: typeof signalPoints.$inferSelect): PointShape => ({
  observed_at: toTimestampMs(row.observedAt) ?? 0,
  fetched_at: toTimestampMs(row.fetchedAt) ?? 0,
  metric_key: row.metricKey,
  dimensions: parseStringRecord(row.dimensions),
  value: row.value,
  value_text: row.valueText,
  unit: row.unit,
  source_url: safeExternalUrl(row.sourceUrl),
  display: { label: '', source_url: null },
});

const toDisplayShape = (
  signal: SignalRow,
  config: Readonly<Record<string, unknown>>,
  points: ReadonlyArray<PointShape>,
): DisplayShape => {
  const display = resolveTemplateDisplay(
    signal.templateId,
    signal.title,
    config,
    points.map((point) => point.source_url),
  );
  return {
    title: display.title,
    source_label: display.sourceLabel,
    source_url: display.sourceUrl,
  };
};

const toDisplayPoint = (templateId: string, point: PointShape): PointShape => {
  const display = resolvePointDisplay(templateId, {
    dimensions: point.dimensions,
    valueText: point.value_text,
    sourceUrl: point.source_url,
  });
  return {
    ...point,
    display: {
      label: display.label,
      source_url: display.sourceUrl,
    },
  };
};

const toStatusShape = (status: StatusRow | null): StatusShape => {
  if (!status) return emptyStatusShape();
  return {
    status: status.status,
    last_ok_at: toTimestampMs(status.lastOkAt),
    last_attempt_at: toTimestampMs(status.updatedAt),
    last_error: status.lastError,
    last_manual_request_at: toTimestampMs(status.lastManualRequestAt),
  };
};

const emptyStatusShape = (): StatusShape => ({
  status: null,
  last_ok_at: null,
  last_attempt_at: null,
  last_error: null,
  last_manual_request_at: null,
});
