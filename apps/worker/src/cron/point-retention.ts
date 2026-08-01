import { templates } from '@antenna/registry';
import { and, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { signalPoints, signals } from '../db/schema';
import { purgeExpiredSnapshots } from './dispatch/snapshot-cache';
import type { WorkerEnv } from '../env';

const DEFAULT_RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionSummary = {
  readonly policies: number;
};

export const shouldRunPointRetention = (now: number): boolean => {
  const date = new Date(now);
  return date.getUTCHours() === 3 && date.getUTCMinutes() === 17;
};

export const runPointRetention = async (
  env: WorkerEnv,
  now = Date.now(),
): Promise<RetentionSummary> => {
  const client = db(env);
  const grouped = groupTemplatesByRetention();

  for (const [days, templateIds] of grouped) {
    const signalIds = client
      .select({ id: signals.id })
      .from(signals)
      .where(inArray(signals.templateId, templateIds));
    await client
      .delete(signalPoints)
      .where(
        and(
          inArray(signalPoints.signalId, signalIds),
          lt(signalPoints.fetchedAt, new Date(now - days * DAY_MS)),
        ),
      )
      .run();
  }

  // Shared upstream snapshots are a short-lived cache, not history.
  await purgeExpiredSnapshots(client, now);

  return { policies: grouped.size };
};

export const groupTemplatesByRetention = (): Map<number, string[]> => {
  const grouped = new Map<number, string[]>();
  for (const template of templates) {
    const days = template.pointRetentionDays ?? DEFAULT_RETENTION_DAYS;
    const ids = grouped.get(days) ?? [];
    ids.push(template.id);
    grouped.set(days, ids);
  }
  return grouped;
};
