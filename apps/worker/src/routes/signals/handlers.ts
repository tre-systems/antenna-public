import {
  signalHistoryQuerySchema,
  signalListQuerySchema,
  signalUpdateSchema,
} from '@antenna/shared';
import { db } from '../../db/client';
import { err, ok } from '../http';
import { deleteOwnedSignal } from './delete-signal';
import { latestPointsForSignals } from './latest-points';
import { buildSignal, toDisplayPoints, toPointShape } from './read-model';
import {
  listOwnedSignalRows,
  loadHistoryPoints,
  loadOwnedSignal,
  loadOwnedSignalRow,
} from './repository';
import {
  manualRefreshRateLimit,
  markManualRefreshRequested,
  type ManualRefreshRateLimit,
} from './refresh';
import {
  signalUpdateResponse,
  persistSignalUpdate,
  resolveSignalUpdate,
  type SignalUpdateFailure,
  type SignalUpdateInput,
} from './updates';
import type { SignalsContext, SignalWithStatus, HistoryShape, PointShape } from './types';

export const listSignals = async (c: SignalsContext): Promise<Response> => {
  const parsed = signalListQuerySchema.safeParse({ collection_id: c.req.query('collection_id') });
  if (!parsed.success) return err(c, 'invalid_query', 400);

  const client = db(c.env);
  const rows = await listOwnedSignalRows(client, c.get('user').id, parsed.data.collection_id);
  return ok(c, await buildSignalList(client, rows));
};

export const getSignal = async (c: SignalsContext): Promise<Response> => {
  const id = routeSignalId(c);
  const client = db(c.env);
  const row = await loadOwnedSignalRow(client, c.get('user').id, id);
  if (!row) return err(c, 'not_found', 404);

  const latestPoints = await latestPointsForSignals(client, [id]);
  return ok(c, buildSignal(row.signal, row.status, latestPoints.get(id) ?? []));
};

export const getSignalHistory = async (c: SignalsContext): Promise<Response> => {
  const id = routeSignalId(c);
  const parsed = signalHistoryQuerySchema.safeParse({ range: c.req.query('range') });
  if (!parsed.success) return err(c, 'invalid_query', 400);

  const client = db(c.env);
  const signal = await loadOwnedSignal(client, c.get('user').id, id);
  if (!signal) return err(c, 'not_found', 404);

  const rows = await loadHistoryPoints(client, id, parsed.data.range);
  return ok(c, historyShape(id, parsed.data.range, signal.templateId, rows.map(toPointShape)));
};

export const refreshSignal = async (c: SignalsContext): Promise<Response> => {
  const id = routeSignalId(c);
  const client = db(c.env);
  const row = await loadOwnedSignalRow(client, c.get('user').id, id);
  if (!row) return err(c, 'not_found', 404);

  const now = new Date();
  const rateLimited = manualRefreshRateLimit(row.status, now.getTime());
  if (rateLimited !== undefined) return rateLimitResponse(c, rateLimited);

  await markManualRefreshRequested(client, id, now);
  return ok(c, { requested: true });
};

export const updateSignal = async (c: SignalsContext): Promise<Response> => {
  const parsed = await parseSignalUpdate(c);
  if (!parsed.ok) return err(c, 'invalid_body', 400);

  const id = routeSignalId(c);
  const client = db(c.env);
  const signal = await loadOwnedSignal(client, c.get('user').id, id);
  if (!signal) return err(c, 'not_found', 404);

  const result = resolveSignalUpdate(signal, parsed.data);
  if (!result.ok) return updateFailureResponse(c, result.failure);

  await persistSignalUpdate(client, signal, result.update);
  return ok(c, signalUpdateResponse(result.update));
};

export const deleteSignal = async (c: SignalsContext): Promise<Response> => {
  const id = routeSignalId(c);
  const client = db(c.env);
  const signal = await loadOwnedSignal(client, c.get('user').id, id);
  if (!signal) return err(c, 'not_found', 404);

  await deleteOwnedSignal(client, signal);
  return ok(c, { deleted: true });
};

const buildSignalList = async (
  client: ReturnType<typeof db>,
  rows: ReadonlyArray<SignalWithStatus>,
) => {
  const latestPoints = await latestPointsForSignals(
    client,
    rows.map((row) => row.signal.id),
  );
  return rows.map((row) =>
    buildSignal(row.signal, row.status, latestPoints.get(row.signal.id) ?? []),
  );
};

const routeSignalId = (c: SignalsContext): string => c.req.param('id') ?? '';

const historyShape = (
  signalId: string,
  range: string,
  templateId: string,
  points: ReadonlyArray<PointShape>,
): HistoryShape => ({
  signal_id: signalId,
  range,
  points: toDisplayPoints(templateId, points),
});

const rateLimitResponse = (c: SignalsContext, rateLimited: ManualRefreshRateLimit): Response => {
  c.header('Retry-After', String(rateLimited.retryAfterSeconds));
  c.header('X-RateLimit-Limit', '1');
  c.header('X-RateLimit-Remaining', '0');
  c.header('X-RateLimit-Reset', String(rateLimited.resetAtSeconds));
  return c.json(
    {
      error: 'rate_limited',
      retry_after_seconds: rateLimited.retryAfterSeconds,
      limit: 1,
      reset_at: rateLimited.resetAtSeconds,
    },
    429,
  );
};

const parseSignalUpdate = async (
  c: SignalsContext,
): Promise<{ readonly ok: true; readonly data: SignalUpdateInput } | { readonly ok: false }> => {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const parsed = signalUpdateSchema.safeParse(raw);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
};

const updateFailureResponse = (c: SignalsContext, failure: SignalUpdateFailure): Response => {
  if (failure.kind === 'source_policy_blocked') {
    return c.json({ error: 'source_policy_blocked', ...failure.blocker }, 409);
  }
  return err(c, failure.error, failure.status);
};
