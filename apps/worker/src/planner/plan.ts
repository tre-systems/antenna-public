import { eq } from 'drizzle-orm';
import { geocode } from '@antenna/connectors';
import { collectionPlanSchema } from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { connectorRequests, collectionPlans, type ProposedPlan } from '../db/schema';
import type { CollectionPlan, PlanRecord, PlanStatus, ProposedSignal } from '@antenna/shared';
import { matchPrompt } from './match';

type Client = ReturnType<typeof db>;

type CreatePlanArgs = {
  readonly collection_id: string;
  readonly prompt: string;
  readonly requested_by: string;
};

export const createPlan = async (env: DbEnv, args: CreatePlanArgs): Promise<PlanRecord> => {
  const client = db(env);
  const initial = matchPrompt(args.prompt);
  const plan = await resolveLocations(initial);
  const id = crypto.randomUUID();
  const now = new Date();

  await client
    .insert(collectionPlans)
    .values({
      id,
      collectionId: args.collection_id,
      prompt: args.prompt,
      // `proposed` is a plain TEXT column; Drizzle's `.$type` is a view, not a
      // serialiser, so we stringify before the insert.
      proposed: JSON.stringify(plan) as unknown as ProposedPlan,
      status: 'proposed',
      createdAt: now,
    })
    .run();

  await insertConnectorRequests(client, args, plan);

  return {
    id,
    collection_id: args.collection_id,
    prompt: args.prompt,
    status: 'proposed',
    plan,
    created_at: now.getTime(),
  };
};

// Async post-step over `matchPrompt`: for weather/airquality signals that still
// need lat/lon, try the Open-Meteo geocoder once per signal. We keep this in
// the planner rather than the templates because `paramExtractors` are sync per
// the adapter contract, and we only want to pay for the network call once per
// prompt. On a miss the signal is left untouched so the UI's manual lat/lon
// fallback still works.
const NEEDS_GEOCODE = new Set(['weather', 'airquality']);

export const resolveLocations = async (plan: CollectionPlan): Promise<CollectionPlan> => {
  const signals = await Promise.all(plan.signals.map(maybeGeocodeSignal));
  return { ...plan, signals };
};

const maybeGeocodeSignal = async (signal: ProposedSignal): Promise<ProposedSignal> => {
  if (!NEEDS_GEOCODE.has(signal.template_id)) return signal;
  const location = signal.config.location;
  if (typeof location !== 'string' || location.trim().length === 0) return signal;
  const needsLat = signal.missing.includes('lat');
  const needsLon = signal.missing.includes('lon');
  if (!needsLat && !needsLon) return signal;

  const hit = await geocode(location);
  if (!hit) return signal;

  return {
    ...signal,
    config: {
      ...signal.config,
      location: hit.resolvedName,
      lat: hit.lat,
      lon: hit.lon,
    },
    missing: signal.missing.filter((k) => k !== 'lat' && k !== 'lon'),
  };
};

const insertConnectorRequests = async (
  client: Client,
  args: CreatePlanArgs,
  plan: CollectionPlan,
): Promise<void> => {
  if (plan.unmatched.length === 0) return;
  const now = new Date();
  await client
    .insert(connectorRequests)
    .values(
      plan.unmatched.map((hint) => ({
        id: crypto.randomUUID(),
        collectionId: args.collection_id,
        prompt: hint.fragment,
        requestedBy: args.requested_by,
        notes: args.prompt,
        status: 'requested' as const,
        createdAt: now,
      })),
    )
    .run();
};

export const rejectPlan = async (
  env: DbEnv,
  planId: string,
  collectionId: string,
): Promise<boolean> => {
  const client = db(env);
  const existing = await findPlanForCollection(client, planId, collectionId);
  if (!existing) return false;
  await client
    .update(collectionPlans)
    .set({ status: 'rejected', resolvedAt: new Date() })
    .where(eq(collectionPlans.id, planId))
    .run();
  return true;
};

export const getPlan = async (
  env: DbEnv,
  planId: string,
  collectionId: string,
): Promise<PlanRecord | undefined> => {
  const client = db(env);
  const row = await findPlanForCollection(client, planId, collectionId);
  if (!row) return undefined;
  return {
    id: row.id,
    collection_id: row.collectionId,
    prompt: row.prompt,
    status: row.status satisfies PlanStatus,
    plan: parsePlan(row.proposed, row.prompt),
    created_at: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
  };
};

const findPlanForCollection = async (
  client: Client,
  planId: string,
  collectionId: string,
): Promise<typeof collectionPlans.$inferSelect | undefined> => {
  const [row] = await client
    .select()
    .from(collectionPlans)
    .where(eq(collectionPlans.id, planId))
    .all();
  if (!row || row.collectionId !== collectionId) return undefined;
  return row;
};

// `proposed` is stored as JSON text. Older rows (v0 prototype shape) won't
// have `signals`/`unmatched` — coerce to an empty plan in that case so the
// route doesn't 500 on legacy data.
export const parsePlan = (raw: unknown, prompt: string): CollectionPlan => {
  let obj: unknown;
  try {
    obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  } catch {
    return { prompt, signals: [], unmatched: [] };
  }
  const parsed = collectionPlanSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  return { prompt, signals: [], unmatched: [] };
};
