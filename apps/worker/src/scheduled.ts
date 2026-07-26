import * as Sentry from '@sentry/cloudflare';
import { cleanupExpiredOAuthState, shouldRunOAuthCleanup } from './auth/oauth-cleanup';
import { runDailyDigests } from './cron/digest';
import { runDispatch } from './cron/dispatch';
import { errorMessage, logErrorEvent, logEvent } from './cron/log';
import { runPointRetention, shouldRunPointRetention } from './cron/point-retention';
import type { WorkerEnv } from './env';

// Every job is isolated: one failure is logged and the tick carries on to the
// rest. Cron logs surface in `wrangler tail`, so the payload is structured JSON.
const runJob = async (event: string, job: () => Promise<unknown>): Promise<void> => {
  try {
    const summary = await job();
    const detail = typeof summary === 'object' && summary !== null ? summary : {};
    logEvent({ event, ...detail });
  } catch (err: unknown) {
    logErrorEvent({ event: `${event}_failed`, error: errorMessage(err) });
  }
};

const runScheduledTick = async (env: WorkerEnv, now: number): Promise<void> => {
  await runJob('dispatch', () => runDispatch(env));
  await runJob('daily_digest', () => runDailyDigests(env));
  if (shouldRunOAuthCleanup(now)) {
    await runJob('oauth_cleanup', () => cleanupExpiredOAuthState(env, now));
  }
  if (shouldRunPointRetention(now)) {
    await runJob('point_retention', () => runPointRetention(env, now));
  }
};

export const runScheduledTickWithTelemetry = (env: WorkerEnv, now = Date.now()): Promise<void> =>
  Sentry.startSpan(
    {
      name: 'Scheduled cron tick',
      op: 'faas.cron',
      forceTransaction: true,
      attributes: { 'sentry.source': 'task' },
    },
    () => runScheduledTick(env, now),
  );
