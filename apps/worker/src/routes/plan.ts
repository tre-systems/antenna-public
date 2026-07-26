import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { planConfirmSchema, planRequestSchema } from '@antenna/shared';
import { db, type Env as DbEnv } from '../db/client';
import { collectionPlans, collections } from '../db/schema';
import type { AuthVars } from '../auth/middleware';
import { ensureUserCollection } from '../auth';
import { confirmPlan } from '../planner/execute';
import { createPlan, getPlan, rejectPlan } from '../planner/plan';
import { err, ok } from './http';

type Bindings = DbEnv;

// The Better Auth hook (`ensureUserCollection`) provisions a collection on
// first sign-in. The BYPASS_AUTH e2e path skips that hook entirely, so we
// also lazy-create on first use here — that keeps the route correct without
// the auth path having to know about every test seam.
const collectionIdForUser = async (
  env: DbEnv,
  userId: string,
  requestedCollectionId?: string,
): Promise<string | undefined> => {
  const client = db(env);
  if (requestedCollectionId !== undefined) {
    const [requested] = await client
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, requestedCollectionId), eq(collections.ownerId, userId)))
      .limit(1)
      .all();
    return requested?.id;
  }

  const find = async (): Promise<string | undefined> => {
    const [row] = await client
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.ownerId, userId))
      .limit(1)
      .all();
    return row?.id;
  };
  const existing = await find();
  if (existing) return existing;
  await ensureUserCollection(client, userId, env.DB);
  const created = await find();
  if (!created) throw new Error('failed to provision collection');
  return created;
};

const collectionIdForOwnedPlan = async (
  env: DbEnv,
  userId: string,
  planId: string,
): Promise<string | undefined> => {
  const [row] = await db(env)
    .select({ id: collections.id })
    .from(collections)
    .innerJoin(collectionPlans, eq(collectionPlans.collectionId, collections.id))
    .where(and(eq(collectionPlans.id, planId), eq(collections.ownerId, userId)))
    .limit(1)
    .all();
  return row?.id;
};

export const planRoute = new Hono<{ Bindings: Bindings; Variables: AuthVars }>()
  .post('/', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = planRequestSchema.safeParse(raw);
    if (!parsed.success) return err(c, 'invalid_body', 400);

    const user = c.get('user');
    const collectionId = await collectionIdForUser(c.env, user.id, parsed.data.collection_id);
    if (!collectionId) return err(c, 'not_found', 404);

    const record = await createPlan(c.env, {
      collection_id: collectionId,
      prompt: parsed.data.prompt,
      requested_by: user.id,
    });
    return ok(c, record);
  })
  .get('/:id', async (c) => {
    const user = c.get('user');
    const collectionId = await collectionIdForOwnedPlan(c.env, user.id, c.req.param('id'));
    if (!collectionId) return err(c, 'not_found', 404);
    const record = await getPlan(c.env, c.req.param('id'), collectionId);
    if (!record) return err(c, 'not_found', 404);
    return ok(c, record);
  })
  .post('/:id/confirm', async (c) => {
    const raw: unknown = (await c.req.json().catch(() => ({}))) ?? {};
    const parsed = planConfirmSchema.safeParse(raw);
    if (!parsed.success) return err(c, 'invalid_body', 400);
    const user = c.get('user');
    const collectionId = await collectionIdForOwnedPlan(c.env, user.id, c.req.param('id'));
    if (!collectionId) return err(c, 'not_found', 404);

    const result = await confirmPlan(c.env, {
      plan_id: c.req.param('id'),
      collection_id: collectionId,
      edited_signals: parsed.data.edited_signals,
    });
    if (!result.ok) {
      // A vanished plan is the only 404 here; everything else is a conflict
      // with the current state.
      return err(c, result.error, result.error === 'plan not found' ? 404 : 409);
    }
    return ok(c, { created_signal_ids: result.created_signal_ids });
  })
  .post('/:id/reject', async (c) => {
    const user = c.get('user');
    const collectionId = await collectionIdForOwnedPlan(c.env, user.id, c.req.param('id'));
    if (!collectionId) return err(c, 'not_found', 404);
    const rejected = await rejectPlan(c.env, c.req.param('id'), collectionId);
    if (!rejected) return err(c, 'not_found', 404);
    return ok(c, { ok: true });
  });
