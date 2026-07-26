import { db } from '../db/client';
import { loadCollectionAlerts } from './digest/alerts';
import { loadDigestCandidates } from './digest/candidates';
import { deliveryExists, deliveryId, recordDelivery } from './digest/deliveries';
import { canSendEmail, sendDigestEmail } from './digest/email';
import { logEvent } from './log';
import {
  cadenceForPreference,
  digestPeriod,
  isDigestWindow,
  isWithinQuietHours,
} from './digest/schedule';
import type {
  AlertRow,
  Candidate,
  Client,
  DigestEnv,
  DigestPeriod,
  DigestSummary,
} from './digest/types';

export type { DigestEnv, DigestSummary } from './digest/types';

type DigestCounts = {
  sent: number;
  skipped: number;
  failed: number;
};
type CandidateOutcome = keyof DigestCounts;

type CandidateContext = {
  readonly env: DigestEnv;
  readonly client: Client;
  readonly candidate: Candidate;
  readonly nowMs: number;
};

type CandidateWork = {
  readonly period: DigestPeriod;
  readonly alerts: readonly AlertRow[];
  readonly deliveryId: string;
};

export const runDailyDigests = async (
  env: DigestEnv,
  nowMs: number = Date.now(),
): Promise<DigestSummary> => {
  if (!isDigestWindow(nowMs)) return emptySummary();

  const client = db(env);
  const candidates = await loadDigestCandidates(client);
  const counts = emptyCounts();

  for (const candidate of candidates) {
    const outcome = await processCandidate({ env, client, candidate, nowMs });
    recordOutcome(counts, outcome);
  }

  const summary = { considered: candidates.length, ...counts };
  logEvent({ event: 'daily_digest_completed', ...summary });
  return summary;
};

const processCandidate = async (context: CandidateContext): Promise<CandidateOutcome> => {
  const work = await prepareCandidateWork(context);
  if (work === null) return 'skipped';

  if (!canSendEmail(context.env)) {
    logSetupRequired(context.candidate);
    return 'skipped';
  }

  return sendAndRecordDigest(context, work);
};

const prepareCandidateWork = async ({
  client,
  candidate,
  nowMs,
}: CandidateContext): Promise<CandidateWork | null> => {
  const period = digestPeriod(candidate.preference, nowMs);
  if (period === null || isWithinQuietHours(candidate.preference, nowMs)) return null;

  const alerts = await loadCollectionAlerts(
    client,
    candidate.collection.id,
    period.start,
    period.end,
  );
  if (alerts.length === 0) return null;

  const id = deliveryId(candidate.user.id, candidate.collection.id, period.key);
  if (await deliveryExists(client, id)) return null;

  return { period, alerts, deliveryId: id };
};

const sendAndRecordDigest = async (
  context: CandidateContext,
  work: CandidateWork,
): Promise<CandidateOutcome> => {
  const { env, client, candidate, nowMs } = context;
  const cadence = cadenceForPreference(candidate.preference);
  const result = await sendDigestEmail(env, candidate, work.alerts, work.period, cadence);

  await recordDelivery(client, {
    id: work.deliveryId,
    userId: candidate.user.id,
    collectionId: candidate.collection.id,
    periodStart: work.period.start,
    periodEnd: work.period.end,
    sentAt: new Date(nowMs),
    status: result.ok ? 'sent' : 'error',
    error: result.ok ? null : result.error,
  });

  return result.ok ? 'sent' : 'failed';
};

const logSetupRequired = (candidate: Candidate): void => {
  logEvent({
    event: 'daily_digest_skipped',
    reason: 'setup_required',
    user_id: candidate.user.id,
    collection_id: candidate.collection.id,
  });
};

const recordOutcome = (counts: DigestCounts, outcome: CandidateOutcome): void => {
  if (outcome === 'sent') counts.sent += 1;
  else if (outcome === 'skipped') counts.skipped += 1;
  else counts.failed += 1;
};

const emptySummary = (): DigestSummary => ({ considered: 0, sent: 0, skipped: 0, failed: 0 });

const emptyCounts = (): DigestCounts => ({ sent: 0, skipped: 0, failed: 0 });
