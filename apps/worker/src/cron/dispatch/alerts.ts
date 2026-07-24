import type { DataPoint } from '@antenna/connectors';
import type { AlertRule } from '@antenna/registry';
import { desc, eq } from 'drizzle-orm';
import { signalAlerts, signalPoints } from '../../db/schema';
import { metricKeyFor } from '../point-row';
import type { SignalRow, Client } from './types';

type PreviousPoint = {
  readonly metricKey: string;
  readonly observedAt: Date;
  readonly value: number | null;
  readonly unit: string | null;
  readonly sourceUrl: string | null;
};

type AlertInsert = typeof signalAlerts.$inferInsert;

export const evaluateAlertRules = async (
  client: Client,
  signal: SignalRow,
  points: ReadonlyArray<DataPoint>,
  now: number,
  rules: readonly AlertRule[],
): Promise<void> => {
  if (rules.length === 0 || points.length === 0) return;
  const previousByMetric = await latestNumericPointsByMetric(client, signal.id);
  const alerts = points.flatMap((point) =>
    alertsForPoint(signal, point, previousByMetric, now, rules),
  );
  await insertAlerts(client, alerts);
};

const alertsForPoint = (
  signal: SignalRow,
  latest: DataPoint,
  previousByMetric: ReadonlyMap<string, PreviousPoint>,
  now: number,
  rules: readonly AlertRule[],
): AlertInsert[] => {
  if (typeof latest.value !== 'number') return [];
  const metricKey = metricKeyFor(latest);
  const previous = previousByMetric.get(metricKey);
  if (!previous || previous.value === null) return [];
  const previousValue = previous.value;
  const observedAt = new Date(Number.isFinite(latest.ts) ? latest.ts : now);
  if (observedAt.getTime() <= previous.observedAt.getTime()) return [];
  return rules
    .filter((rule) => ruleMatches(rule, latest, previous))
    .map((rule) =>
      alertRow(signal, rule, latest, previous, previousValue, metricKey, observedAt, now),
    );
};

const ruleMatches = (rule: AlertRule, latest: DataPoint, previous: PreviousPoint): boolean =>
  previous.value !== null &&
  rule.condition({
    latest,
    previous: previousDataPoint(latest, previous),
    latestValue: latest.value as number,
    previousValue: previous.value,
  });

const previousDataPoint = (latest: DataPoint, previous: PreviousPoint): DataPoint => ({
  dimensions: latest.dimensions,
  value: previous.value ?? 0,
  unit: previous.unit ?? undefined,
  ts: previous.observedAt.getTime(),
  sourceUrl: previous.sourceUrl ?? undefined,
});

const alertRow = (
  signal: SignalRow,
  rule: AlertRule,
  latest: DataPoint,
  previous: PreviousPoint,
  previousValue: number,
  metricKey: string,
  observedAt: Date,
  now: number,
): AlertInsert => ({
  id: alertId(signal.id, rule.id, metricKey, observedAt.getTime()),
  collectionId: signal.collectionId,
  signalId: signal.id,
  ruleId: rule.id,
  ruleLabel: rule.label,
  metricKey,
  observedAt,
  triggeredAt: new Date(now),
  value: latest.value as number,
  previousValue,
  unit: latest.unit ?? previous.unit,
  sourceUrl: latest.sourceUrl ?? previous.sourceUrl,
});

const insertAlerts = async (client: Client, alerts: ReadonlyArray<AlertInsert>): Promise<void> => {
  for (const alert of alerts) {
    await client.insert(signalAlerts).values(alert).onConflictDoNothing().run();
  }
};

const latestNumericPointsByMetric = async (
  client: Client,
  signalId: string,
): Promise<ReadonlyMap<string, PreviousPoint>> => {
  const rows = await client
    .select({
      metricKey: signalPoints.metricKey,
      observedAt: signalPoints.observedAt,
      value: signalPoints.value,
      unit: signalPoints.unit,
      sourceUrl: signalPoints.sourceUrl,
    })
    .from(signalPoints)
    .where(eq(signalPoints.signalId, signalId))
    .orderBy(desc(signalPoints.observedAt))
    .all();

  const latest = new Map<string, PreviousPoint>();
  for (const row of rows) addLatestNumericPoint(latest, row);
  return latest;
};

const addLatestNumericPoint = (latest: Map<string, PreviousPoint>, row: PreviousPoint): void => {
  if (latest.has(row.metricKey)) return;
  if (row.value === null) return;
  latest.set(row.metricKey, row);
};

const alertId = (signalId: string, ruleId: string, metricKey: string, observedAt: number): string =>
  `${signalId}:${ruleId}:${metricKey}:${String(observedAt)}`;
