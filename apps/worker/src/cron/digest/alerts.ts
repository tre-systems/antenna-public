import { and, eq, gte, lt } from 'drizzle-orm';
import { signalAlerts, signals } from '../../db/schema';
import type { AlertRow, Client } from './types';

export const loadCollectionAlerts = (
  client: Client,
  collectionId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<AlertRow[]> =>
  client
    .select({ alert: signalAlerts, signal: signals })
    .from(signalAlerts)
    .innerJoin(signals, eq(signals.id, signalAlerts.signalId))
    .where(
      and(
        eq(signalAlerts.collectionId, collectionId),
        gte(signalAlerts.triggeredAt, periodStart),
        lt(signalAlerts.triggeredAt, periodEnd),
      ),
    )
    .all();
