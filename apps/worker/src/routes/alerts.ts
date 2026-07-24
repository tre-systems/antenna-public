import { and, desc, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { safeExternalUrl } from '@antenna/registry';
import {
  signalAlertsQuerySchema,
  type SignalAlertListResponse,
  type SignalAlertRecord,
} from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import { db, type Env as DbEnv } from '../db/client';
import { toTimestampMs } from '../db/codecs';
import { signalAlerts, collections, signals } from '../db/schema';
import { err, ok } from './http';

type Bindings = DbEnv;

export const alertsRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>().get(
  '/',
  async (c) => {
    const parsed = signalAlertsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return err(c, 'invalid_query', 400);

    const userId = c.get('user').id;
    const query = parsed.data;
    const conditions = [eq(collections.ownerId, userId)];
    if (query.collection_id !== undefined) {
      conditions.push(eq(signalAlerts.collectionId, query.collection_id));
    }
    if (query.since !== undefined) {
      conditions.push(gte(signalAlerts.triggeredAt, new Date(query.since)));
    }

    const rows = await db(c.env)
      .select({
        alert: signalAlerts,
        signal: signals,
      })
      .from(signalAlerts)
      .innerJoin(signals, eq(signals.id, signalAlerts.signalId))
      .innerJoin(collections, eq(collections.id, signalAlerts.collectionId))
      .where(and(...conditions))
      .orderBy(desc(signalAlerts.triggeredAt), desc(signalAlerts.observedAt))
      .limit(query.limit)
      .all();

    return ok(c, {
      alerts: rows.map(({ alert, signal }) => toAlertRecord(alert, signal)),
    } satisfies SignalAlertListResponse);
  },
);

const toAlertRecord = (
  alert: typeof signalAlerts.$inferSelect,
  signal: typeof signals.$inferSelect,
): SignalAlertRecord => ({
  id: alert.id,
  collection_id: alert.collectionId,
  signal_id: alert.signalId,
  template_id: signal.templateId,
  title: signal.title,
  rule_id: alert.ruleId,
  rule_label: alert.ruleLabel,
  metric_key: alert.metricKey,
  observed_at: toTimestampMs(alert.observedAt) ?? 0,
  triggered_at: toTimestampMs(alert.triggeredAt) ?? 0,
  value: alert.value,
  previous_value: alert.previousValue,
  unit: alert.unit ?? null,
  source_url: safeExternalUrl(alert.sourceUrl),
});
