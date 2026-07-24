import { sourcePolicyForTemplate } from '@antenna/registry';
import type { CollectionRecord, PublicApiSignal, SignalStatus } from '@antenna/shared';
import type { signals } from '../db/schema';
import { canReadSignalWithSourcePolicy } from '../policy/source-access';
import type { buildSignal } from './signals';
import { toCollectionRecord } from './collection-record';

type SignalRow = typeof signals.$inferSelect;

export const isPublicReadableSignal = (signal: SignalRow): boolean => {
  const decision = canReadSignalWithSourcePolicy({
    collectionVisibility: 'public',
    signalVisibility: signal.visibility,
    policy: sourcePolicyForTemplate(signal.templateId),
    audience: 'public',
  });
  return decision.ok;
};

export const toPublicCollectionRecord = (
  collection: Parameters<typeof toCollectionRecord>[0],
  visibleSignalIds: ReadonlySet<string>,
): CollectionRecord => {
  const record = toCollectionRecord(collection);
  if (!record.layout) return record;
  return {
    ...record,
    layout: {
      ...record.layout,
      slots: record.layout.slots.filter((slot) => visibleSignalIds.has(slot.signal_id)),
    },
  };
};

// Anonymous public/shared readers may see whether a signal is healthy or stale,
// but never the raw adapter error text. `last_error` is built from the upstream
// failure (cron/dispatch/result.ts) and can carry internal hostnames, request
// fragments, or provider detail that must stay owner-only.
export const redactStatusForPublic = (status: SignalStatus): SignalStatus =>
  status.last_error === null ? status : { ...status, last_error: null };

export const toPublicSignal = (signal: ReturnType<typeof buildSignal>): PublicApiSignal => ({
  id: signal.id,
  template_id: signal.template_id,
  title: signal.title,
  visibility: signal.visibility,
  display: signal.display,
  source_policy: signal.source_policy ?? undefined,
  status: redactStatusForPublic(signal.status),
  points: signal.points,
});

// HMAC the requester's IP + User-Agent so abuse reports can be rate-limited and
// de-duplicated without storing QQQ. The key matters: a plain SHA-256 of
// `ip\nUA` is brute-forceable (the IP space plus a handful of common UA strings
// is small enough to confirm a specific reporter by recomputing the digest).
// Keying with a server secret makes the hash uncomputable off-server. The HMAC
// output never reveals the key, so reusing BETTER_AUTH_SECRET here is safe.
export const requesterMetadataHash = async (request: Request, secret: string): Promise<string> => {
  const forwarded =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    request.headers.get('X-Real-IP') ??
    'unknown';
  const userAgent = request.headers.get('User-Agent') ?? 'unknown';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${forwarded}\n${userAgent}`),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
