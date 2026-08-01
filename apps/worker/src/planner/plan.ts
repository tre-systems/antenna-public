import { eq } from 'drizzle-orm';
import { geocode } from '@antenna/connectors';
import { collectionPlanSchema } from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { connectorRequests, collectionPlans, type ProposedPlan } from '../db/schema';
import type { CollectionPlan, PlanRecord, PlanStatus, ProposedSignal } from '@antenna/shared';
import { matchPrompt, planTemplate } from './match';

type Client = ReturnType<typeof db>;

type CreatePlanBaseArgs = {
  readonly collection_id: string;
  readonly requested_by: string;
};

type CreatePromptPlanArgs = CreatePlanBaseArgs & { readonly prompt: string };
type CreateTemplatePlanArgs = CreatePlanBaseArgs & { readonly template_id: string };

export function createPlan(env: DbEnv, args: CreatePromptPlanArgs): Promise<PlanRecord>;
export function createPlan(
  env: DbEnv,
  args: CreateTemplatePlanArgs,
): Promise<PlanRecord | undefined>;
export async function createPlan(
  env: DbEnv,
  args: CreatePromptPlanArgs | CreateTemplatePlanArgs,
): Promise<PlanRecord | undefined> {
  const client = db(env);
  const initial = 'template_id' in args ? planTemplate(args.template_id) : matchPrompt(args.prompt);
  if (!initial) return undefined;
  const prompt = initial.prompt;
  const plan = await resolveLocations(initial);
  const id = crypto.randomUUID();
  const now = new Date();

  await client
    .insert(collectionPlans)
    .values({
      id,
      collectionId: args.collection_id,
      prompt,
      // Stringify proposed because Drizzle's $type does not serialize TEXT.
      proposed: JSON.stringify(plan) as unknown as ProposedPlan,
      status: 'proposed',
      createdAt: now,
    })
    .run();

  await insertConnectorRequests(client, { ...args, prompt }, plan);

  return {
    id,
    collection_id: args.collection_id,
    prompt,
    status: 'proposed',
    plan,
    created_at: now.getTime(),
  };
}

const NEEDS_GEOCODE = new Set(['weather', 'airquality']);

// Resolve locations here because template parameter extractors are synchronous.
const resolveLocations = async (plan: CollectionPlan): Promise<CollectionPlan> => {
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
  args: CreatePlanBaseArgs & { readonly prompt: string },
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

// Coerce prototype plan rows to an empty plan rather than failing legacy reads.
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
